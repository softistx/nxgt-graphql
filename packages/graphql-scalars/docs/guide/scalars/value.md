# Value scalars

The `value` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

These three are about the value itself, not a format: any JSON value, a JSON
object, and no value at all. `JSON` and `JSONObject` keep the value as it is,
a plain JavaScript value in the resolver and the same JSON on the wire.

What JSON cannot write back as it is is refused, **both ways** (an input and a
resolver's result): a cycle, `undefined` (as an object's field or an array's
hole), a `Date`, a `Map`, a class instance, `NaN` or `Infinity`, a `bigint`,
and nesting past 1000 levels. A plain object (`{}` or `Object.create(null)`)
and an array are walked; a shared, not cyclic, object is fine.

| Refused | Say instead |
| --- | --- |
| a `Date` | `date.toISOString()` |
| a `Map` or a class instance | `Object.fromEntries(map)`, or the plain fields |
| a `bigint` | `String(n)`, or [`Long`](number.md) |
| `{ a: undefined }` | leave the key out, or use `null` |
| `NaN`, `Infinity` | `null`, or leave the key out |

## Which one?

Use a typed input (an `input` type, or a scalar of your own) wherever the
shape is known: the schema documents it, a client is checked against it at
build time, and the server refuses a bad field by name. `JSON` and
`JSONObject` are for a value the API does not own, such as a client's saved
view, a webhook payload to store as it came, or a feature flag's settings.
When the shape is known but you still want a single field, see
[a JSON-holding scalar of your own](#your-own-json-holding-scalar) below.

## `JSON`

Export `JSONScalar`, schema `jsonSchema`. Any JSON value on both sides:
`null`, a boolean, a string, a finite number, an array or a plain object of
them. Accepts `null`, `true`, `0`, `-1.5`, `'text'`, `[]`, `[1, 'a', null]`,
`{}` and `{ a: { b: [null, false] } }`; refuses `undefined`, `NaN`,
`Infinity`, `1n`, a `Date`, a `Map`, a function, `{ a: undefined }`,
`[1, undefined]`, a cycle and a value nested past 1000 levels.

A query literal of **every kind** is read, objects and lists included: an
enum value becomes its name (`RED` is `'RED'`), and a variable inside the
literal takes its value.

```ts
import { parseValue } from 'graphql';
import { JSONScalar } from '@nxgt/graphql-scalars';

JSONScalar.parseValue({ a: [1, 'x'] }); // { a: [1, 'x'] }
JSONScalar.parseLiteral(parseValue('{ a: [1, "x"], c: RED }'), undefined);
// { a: [1, 'x'], c: 'RED' }
JSONScalar.parseValue(new Date());
// throws: JSON cannot represent this input: Expected a JSON value
JSONScalar.serialize(Number.NaN);
// throws: JSON cannot serialize this value: Expected a JSON value
```

As a query literal, as a variable, and as a literal holding a variable:

```graphql
query {
  echo(value: { a: [1, "x"] })
}

query ($v: JSON) {
  echo(value: $v)
}

query ($n: JSON) {
  echo(value: { n: $n, list: [$n] })
}
```

With `$n` set to `7`, the last gives `{ n: 7, list: [7] }`. With `$n` not
given, it gives `{ list: [null] }`: the field is left out and the list item is
`null`, on graphql 16 as on 17.

Two graphql 16 limits no scalar can fix:

- A variable of another custom scalar inside the literal (`{ at: $date }` with
  `$date: DateTime`) arrives as its resolver value, a `Date`, which `JSON`
  refuses. graphql 17 passes its wire value, the string. Send such a value in
  a `JSON` variable instead.
- An object or list default for a `JSON` argument (`v: JSON = { a: 1 }` in
  SDL, or code-first `defaultValue: { a: 1 }`) makes `printSchema` throw
  `Cannot convert value to AST`, and an introspection query fail with
  `Unexpected invariant triggered.`. graphql 17 prints an SDL default and a
  code-first `default: { value: { a: 1 } }`, but its deprecated
  `defaultValue: { a: 1 }` throws there too.

## `JSONObject`

Export `JSONObjectScalar`, schema `jsonObjectSchema`. A plain object whose
every field is a JSON value, on both sides. Accepts `{}`, `{ a: 1 }`,
`{ a: { b: [null] } }` and `Object.create(null)`; refuses `null`, `[]`,
`[{}]`, `'text'`, `1`, `true`, a `Date`, a `Map`, `{ a: undefined }`,
`{ a: Number.NaN }`, `undefined`, and everything `JSON` refuses. It reads
literals as `JSON` does; a list literal is refused.

```ts
import { parseValue } from 'graphql';
import { JSONObjectScalar } from '@nxgt/graphql-scalars';

JSONObjectScalar.parseValue({ a: 1 }); // { a: 1 }
JSONObjectScalar.parseValue([1]);
// throws: JSONObject cannot represent this input: Expected a JSON object
JSONObjectScalar.parseLiteral(parseValue('[1]'), undefined);
// throws: JSONObject cannot represent this input: Expected a JSON object
```

## `Void`

Export `VoidScalar`, schema `voidSchema`. No value: the type of a field that
only acts, such as a mutation with nothing to return. `null` is the one value
on both sides.

GraphQL writes `null` without asking the scalar, so a resolver that returns
nothing (`undefined`) answers `null`. A resolver that returns anything else
is refused rather than dropped, so a value you meant to send is not lost
silently. As an input it accepts `null` only.

```ts
import { VoidScalar } from '@nxgt/graphql-scalars';

VoidScalar.parseValue(null); // null
VoidScalar.parseValue(0);
// throws: Void cannot represent this input: Expected no value
VoidScalar.serialize(1);
// throws: Void cannot serialize this value: Expected no value
```

Refused as well: `undefined`, `''`, `false`, `{}` and `'null'`.

```ts
import { graphql, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { VoidScalar } from '@nxgt/graphql-scalars';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: { ping: { type: VoidScalar, resolve: () => 'pong' } },
  }),
  mutation: new GraphQLObjectType({
    name: 'Mutation',
    fields: { clear: { type: VoidScalar, resolve: () => undefined } },
  }),
});

await graphql({ schema, source: 'mutation { clear }' });
// { data: { clear: null } }
await graphql({ schema, source: '{ ping }' });
// { data: { ping: null }, errors: [Void cannot serialize this value: Expected no value] }
```

## Your own JSON-holding scalar

`zodScalar` reads a query literal of a string, number or boolean only, so a
scalar of your own whose input is an object would refuse `{ theme: dark }`
written in the query (`cannot represent a ObjectValue literal`) while
accepting the same value as a variable. Pass `literals: 'any'` to read every
literal as `JSON` does, then let your schema check the shape:

```ts
import { parseValue } from 'graphql';
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const Settings = zodScalar(
  z.object({ theme: z.enum(['light', 'dark']), size: z.int().optional() }),
  { name: 'Settings', literals: 'any' },
);

Settings.parseLiteral(parseValue('{ theme: dark, size: 3 }'), undefined);
// { theme: 'dark', size: 3 }   (the enum value arrives as its name)
Settings.parseValue({ theme: 'blue' });
// throws: Settings cannot represent this input: Invalid option: expected one of "light"|"dark"
```

See [Custom scalars](../custom-scalars.md#literals) for the other literal
modes.

## Together

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('JSON', 'JSONObject', 'Void');

const views = new Map<string, Record<string, unknown>>();

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Query {
        view(id: ID!): JSONObject
      }
      type Mutation {
        saveView(id: ID!, view: JSONObject!): Void
        track(event: String!, data: JSON): Void
      }
    `,
  ],
  resolvers: {
    ...resolvers,
    Query: { view: (_, args: { id: string }) => views.get(args.id) ?? null },
    Mutation: {
      saveView: (_, args: { id: string; view: Record<string, unknown> }) => {
        views.set(args.id, args.view);
      },
      track: () => undefined,
    },
  },
});
```

```graphql
mutation {
  saveView(id: "home", view: { columns: ["name", "age"], sort: { by: "name" } })
}
```
