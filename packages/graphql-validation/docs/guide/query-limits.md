# Limiting the depth and cost of a query

`maxDepth`, `maxListCost` and `maxFields` are graphql-js validation rules. They refuse an
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

Neither bounds breadth: a query of 2000 aliases of `item(id: "1") { id }` is two
levels deep and costs 4000, yet selects 4000 fields for the executor to run; so does a
query of thousands of aliases of `__typename`, which neither rule counts.
`maxFields` bounds that.

## Use

With graphql-js, add the rules to the ones `validate` already runs:

```ts
import { maxDepth, maxFields, maxListCost } from '@nxgt/graphql-validation';
import { parse, specifiedRules, validate } from 'graphql';

const errors = validate(schema, parse(query), [
  ...specifiedRules,
  maxDepth({ depth: 8 }),
  maxListCost({ budget: 10_000, defaultFirst: 50 }),
  maxFields({ limit: 500 }),
]);
```

With graphql-yoga, in a plugin:

```ts
import { maxDepth, maxFields, maxListCost } from '@nxgt/graphql-validation';
import { createYoga } from 'graphql-yoga';

createYoga({
  schema,
  plugins: [
    {
      onValidate: ({ addValidationRule }) => {
        addValidationRule(maxDepth({ depth: 8 }));
        addValidationRule(maxListCost({ budget: 10_000, defaultFirst: 50 }));
        addValidationRule(maxFields({ limit: 500 }));
      },
    },
  ],
});
```

Each rule reports **one** `GraphQLError` per operation, whose `nodes` is the
operation. An invalid option (`depth: 0`, a fractional `budget`, `limit: 0`) throws a
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
other. The standard introspection query costs on the order of 200,000 even on a
schema of one field, so it is refused by a budget
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
| a bigint (an SDL default held by a code-first schema, or after graphql-tools' `mapSchema`) | that number |
| an integral Float literal (`first: 1000.0`, `first: 1e3`) | that number; `1.5` and `-1000.0` are unusable |
| a negative literal (`first: -1000`), another string | as if unusable, see below |
| a variable (`first: $n`) | as if unusable: validation has no variable values |
| not given | its SDL default, when it has one; else nothing |

An SDL default is read the same way: `limit: String = "1000"` and `first:
Float = 1000.0` are sizes of 1000. Every size is held at most
`Number.MAX_SAFE_INTEGER`.

An argument given but unusable counts for its SDL default when it has one in
any accepted form (`items(first: Int = 100)`), and `defaultFirst` otherwise. On
an abstract parent that is the largest default, or `defaultFirst` when it is
larger and some possible type has no default. A
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

### Relay connections

On a Relay connection the size is on a field that returns an **object**, and the
list is below it:

```graphql
type Query { items(first: Int): ItemConnection! }
type ItemConnection { edges: [ItemEdge!]! nodes: [Item!]! pageInfo: PageInfo! }
```

```graphql
{ items(first: 100) { edges { node { id } } nodes { id } } }
```

A field that is not a list and states a size, read as for a list above (a size
argument given, or declared with a default; on an abstract parent the largest
over its possible types), hands it down as a **pending size** to the lists
selected **directly on its return type**:

- Only a list that **declares none of the size arguments** takes it, instead of
  `defaultFirst`: `edges` and `nodes` above are both 100. A list that declares
  one (`recent(first: Int)`) reads its own arguments, else `defaultFirst`,
  never the pending size.
- On an interface, when some possible types declare a size argument on that list and others do not, the larger of the pending size and the list's own reading is used, since the query cannot say which comes back.
- It stops at the first field crossed: an object field (`owner`), `pageInfo` or
  a wrapper object passes nothing on, so the lists below them are sized as
  without a connection. In `items(first: 0) { owner { friends { … } } }` the
  `0` does not reach `friends`. A nested field that states a size hands its own
  to the lists directly on it.
- A connection field that states nothing (no size argument given, none declared
  with a default) hands down nothing: its lists are sized `defaultFirst`, as
  before. A variable, a negative number or an unusable value on it counts as for
  a list: its SDL default, else `defaultFirst`.
- The rule is structural: any non-list field stating a size sizes the lists
  declaring no size argument directly on its return type, whether or not it is
  a connection. `user(limit: 0) { friends { … } }` sizes `friends` 0. So an
  argument named in `sizeArguments` must size the lists directly under its
  field: when one of yours means something else, leave its name out of
  `sizeArguments` (or rename the argument).
- Inline fragments, and fragment spreads, on that same selection set pass the
  pending size through. A named fragment is costed once for each distinct
  pending size it is spread under (`...C` under
  `first: 2` and `first: 5` costs differently). Under more than eight distinct
  sizes in one document a fragment's further sizes are rounded up to the next
  power of two, so the work stays linear in the document and the cost only
  over-counts.

### Fragments and abstract types

Named fragments are followed, each costed once per pending size (see above;
a fragment's type condition fixes
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

## `maxFields({ limit, ignoreIntrospection? })`

The size of an operation is the number of field selections in its document,
fragment spreads expanded. It is not what the executor runs: how often a field
runs inside a list is `maxListCost`'s business, so `maxFields` alone does not
bound execution.

- Every field node counts 1: aliases count (`a1: id a2: id` is 2), and so does
  `__typename`.
- A named fragment counts **at each spread**: a fragment of 3 fields spread
  twice adds 6. Each fragment is walked once, so the work stays linear in the
  size of the document even when spreads multiply. A fragment cycle counts 0
  (`NoFragmentCyclesRule` reports it).
- Inline fragments count their contents. No type condition prunes anything:
  every branch of a union or an interface counts, so the figure can only be
  over the document's field count.
- `@skip` and `@include` are not evaluated (the rules read the document, not its
  variables): a field they would remove is counted anyway.
- `__schema` and `__type` and everything under them count like any field.
  The standard introspection query (`getIntrospectionQuery()`) selects **220
  fields** on graphql 16 and 17 (the fragments `FullType`, `InputValue` and
  `TypeRef` are counted at each spread), so a limit under 220 refuses it. Where
  introspection is disabled, or the client is trusted (GraphiQL in development),
  pass `ignoreIntrospection: true`.

The refusal:

```json
{
  "message": "Operation \"Wide\" selects 4000 fields, more than the 500 allowed",
  "extensions": { "code": "QUERY_TOO_WIDE", "fields": 4000, "limit": 500 }
}
```

`fields` is the operation's real count, held at `Number.MAX_SAFE_INTEGER`
whatever a hostile query multiplies. An anonymous operation reads
`Operation selects 4000 fields, ...`. `limit` must be an integer from 1 to
`Number.MAX_SAFE_INTEGER - 1`, else a `RangeError`.

### Choosing a limit

Count the fields of your largest legitimate query, spreads included (a page
that spreads a 10-field fragment on 20 list entries reads 200 plus the rest),
and add headroom: a few hundred covers most screens. Keep the introspection
query in mind (220) if you leave it counted. `maxFields` complements the other
two: `maxDepth` bounds nesting, `maxListCost` bounds list multiplication, and
`maxFields` bounds how many fields one request may name.

## Not covered

- A size carried inside an input object (`items(page: { first: 1000 })`) is not
  read: the field has no size argument, so it is sized `defaultFirst`. Name the
  size as an argument, or raise `defaultFirst`.
- A nested list `[[X]]` is sized **once**: the inner lists are not multiplied. A
  schema returning a list of lists should size it with its own argument.
- The rules read the document, not its variables' values, and not what a
  resolver does: a resolver can still return more than `first` items. They
  complement a page-size cap in the resolver; they do not replace it.
