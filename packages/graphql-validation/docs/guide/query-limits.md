# Limiting the depth and cost of a query

`maxDepth` and `maxListCost` are graphql-js validation rules. They refuse an
operation before any resolver runs, so a hostile query costs a walk of its
document and nothing more. For `@constraint`, see
[Constraints](constraints.md).

## Why

A schema with a list cycle lets a client multiply a cost at each level:

```graphql
type Folder { id: ID! items(first: Int = 100): [Item!]! }
type Item { id: ID! folder: Folder! }
type Query { folder(id: ID!): Folder }
```

```graphql
query {
  folder(id: "1") {
    items { folder { items { folder { items { folder { items { id } } } } } } }
  }
}
```

Four `items` levels of 100 each can ask for 100 million nodes in a query nine
levels deep (`folder`, four `items`, three `folder`, `id`). `maxDepth` bounds the nesting; `maxListCost` bounds the work.

## Use

With graphql-js, add the rules to the ones `validate` already runs:

```ts
import { maxDepth, maxListCost } from '@nxgt/graphql-validation';
import { parse, specifiedRules, validate } from 'graphql';

const errors = validate(schema, parse(query), [
  ...specifiedRules,
  maxDepth({ depth: 8 }),
  maxListCost({ budget: 10_000, defaultFirst: 50 }),
]);
```

With graphql-yoga, in a plugin:

```ts
import { createYoga } from 'graphql-yoga';

createYoga({
  schema,
  plugins: [
    {
      onValidate: ({ addValidationRule }) => {
        addValidationRule(maxDepth({ depth: 8 }));
        addValidationRule(maxListCost({ budget: 10_000, defaultFirst: 50 }));
      },
    },
  ],
});
```

Each rule reports **one** `GraphQLError` per operation, whose `nodes` is the
operation. An invalid option (`depth: 0`, a fractional `budget`) throws a
`RangeError` when the rule is created.

## `maxDepth({ depth, ignoreIntrospection? })`

The depth of an operation is the nesting of its field selections: a top-level
field is depth 1.

- Named fragments are followed, each measured once. A fragment cycle adds
  nothing (`NoFragmentCyclesRule` reports it).
- Inline fragments add no depth.
- `__typename` does not count. `__schema` and `__type` count like any field:
  the standard introspection query (`getIntrospectionQuery()`) is **15 levels
  deep**, so `maxDepth({ depth: 8 })` refuses it. Where introspection is
  disabled, or the client is trusted (GraphiQL in development), pass
  `ignoreIntrospection: true`: `__schema` and `__type` and everything under
  them are then left out.

```ts
maxDepth({ depth: 8, ignoreIntrospection: process.env.NODE_ENV !== 'production' });
```

The refusal:

```json
{
  "message": "Operation \"Deep\" is 9 levels deep, more than the 8 allowed",
  "extensions": { "code": "QUERY_TOO_DEEP", "depth": 9, "limit": 8 }
}
```

`depth` is the operation's real depth. An anonymous operation reads
`Operation is 9 levels deep, ...`.

## `maxListCost({ budget, defaultFirst, sizeArguments?, ignoreIntrospection? })`

### How cost is counted

A field costs 1, times the sizes of the list fields enclosing it. A list field
multiplies the cost of its sub-selection by its size; a field that is not a list
multiplies by 1. A list field that selects nothing below it (`tags: [String!]!`)
costs 1.

```graphql
{ folder(id: "1") { id items(first: 5) { id } } }
# folder 1 + id 1 + items 1 + 5 * id 1 = 8
```

A type that is a list once unwrapped from non-null is one list, nested
`[[X]]` included. `__typename` costs nothing.

`__schema` and `__type` are costed like any field, their lists sized by the
schema itself: `__Schema.types` is the number of types of the schema, and
`fields`, `inputFields`, `enumValues`, `args`, `interfaces`, `possibleTypes`,
`directives` and `locations` are the longest such list anywhere in the schema.
A query repeating `a1: __schema { ... }` hundreds of times is refused like any
other. The standard introspection query costs about 185,000 on a schema of one
field (graphql 16.11; about 222,000 on graphql 17), so it is refused by a budget
of 10,000: pass `ignoreIntrospection: true` where introspection is disabled or
the client is trusted, such as GraphiQL in development.

### How a list is sized

A list field is sized by its **size arguments**, `['first', 'last', 'limit']`
unless `sizeArguments` says otherwise:

```ts
maxListCost({ budget: 10_000, defaultFirst: 50, sizeArguments: ['first', 'pageSize'] });
```

Each size argument the field gives or declares a default for says a size, and
the **largest** wins: `items(first: 0, limit: 1000000)` is a million items. An
argument says:

| Argument | Size |
| --- | --- |
| a literal Int, 0 or more (`first: 5`) | that number |
| a string literal holding a canonical integer (`limit: "100000000"`, for a `Long`-like scalar) | that number: digits only, no sign, no leading zero |
| a negative literal (`first: -1000`), another string | as if unusable, see below |
| a variable (`first: $n`) | as if unusable: validation has no variable values |
| not given | its SDL default, when it has one; else nothing |

An argument given but unusable counts for its SDL default when it is a
non-negative Int (`items(first: Int = 100)`), and `defaultFirst` otherwise. A
field where no size argument says anything is sized `defaultFirst`.

On an interface or a union, the default is the **largest** over the interface's
field and the field of every possible type (`Node.kids(first: Int = 1)` next to
`Folder.kids(first: Int = 100000)` is sized 100,000), since the query cannot
say which object comes back.

A negative number is therefore never taken as a size: no subtree costs less than
nothing, and `items(first: -1000)` next to an expensive sibling cannot cancel
the sibling's cost.

Pick `defaultFirst` knowing a variable counts for it: a client using
`first: $n` is charged the default whatever it sends. If your server caps a size
argument, set `defaultFirst` (or the SDL default) at that cap.

### Fragments and abstract types

Named fragments are followed, each costed once (a fragment's type condition fixes
its parent type). A fragment spread twice counts twice. Inline fragments and
fragments on an interface or a union are **summed branch by branch**: a
selection `... on A { ... } ... on B { ... }` costs A's plus B's, although an
object is one of them. The cost of a query on an abstract type is overestimated,
never underestimated.

### The refusal

```json
{
  "message": "Operation \"Big\" costs 5002, more than the 1000 allowed",
  "extensions": { "code": "QUERY_TOO_COSTLY", "cost": 5002, "limit": 1000 }
}
```

`budget` and `defaultFirst` must be integers below `Number.MAX_SAFE_INTEGER`
(a cost never exceeds it, so a budget at or over it would refuse nothing); the
rule throws a `RangeError` otherwise.

Costs are plain numbers, computed from memoized fragments (no exponential work
on a hostile query) and held at `Number.MAX_SAFE_INTEGER`: `cost` is exact below
it and never `Infinity`.

## Not covered

The rules read the document, not its variables' values, and not what a resolver
does: a resolver can still return more than `first` items. They complement a
page-size cap in the resolver; they do not replace it.
