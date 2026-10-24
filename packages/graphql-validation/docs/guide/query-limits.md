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

Four `items` levels of 100 each can ask for 100 million nodes in a 9-level
query. `maxDepth` bounds the nesting; `maxListCost` bounds the work.

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

## `maxDepth({ depth })`

The depth of an operation is the nesting of its field selections: a top-level
field is depth 1.

- Named fragments are followed, each measured once. A fragment cycle adds
  nothing (`NoFragmentCyclesRule` reports it).
- Inline fragments add no depth.
- `__typename` and the introspection meta-fields (`__schema`, `__type` and
  everything under them) do not count.

The refusal:

```json
{
  "message": "Operation \"Deep\" is 9 levels deep, more than the 8 allowed",
  "extensions": { "code": "QUERY_TOO_DEEP", "depth": 9, "limit": 8 }
}
```

`depth` is the operation's real depth. An anonymous operation reads
`Operation is 9 levels deep, ...`.

## `maxListCost({ budget, defaultFirst, sizeArguments? })`

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
`[[X]]` included. Introspection meta-fields cost nothing.

### How a list is sized

The size is read from the first of `sizeArguments` (default `['first', 'last',
'limit']`) given on the field:

| Argument | Size |
| --- | --- |
| a literal Int, 0 or more (`first: 5`) | that number |
| a negative literal (`first: -1000`) | as if absent, see below |
| a variable (`first: $n`) | as if absent: validation has no variable values |
| not given | as if absent |

"As if absent" is the argument's SDL default when it is a non-negative Int
(`items(first: Int = 100)`), and `defaultFirst` otherwise. When no size
argument is given, the first of `sizeArguments` the field declares with such a
default is used.

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

Costs are plain numbers, computed from memoized fragments (no exponential work
on a hostile query) and held at `Number.MAX_SAFE_INTEGER`: `cost` is exact below
it and never `Infinity`.

## Not covered

The rules read the document, not its variables' values, and not what a resolver
does: a resolver can still return more than `first` items. They complement a
page-size cap in the resolver; they do not replace it.
