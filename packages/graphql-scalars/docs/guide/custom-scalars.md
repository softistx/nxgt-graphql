# Custom scalars

`zodScalar` turns a Zod schema into a `GraphQLScalarType` that checks every
value crossing the API, in both directions. For the scalars the package ships
see [Scalars](scalars.md).

## The smallest example

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const Slug = zodScalar(z.string().regex(/^[a-z-]+$/), { name: 'Slug' });

Slug.parseValue('my-post'); // 'my-post'
Slug.serialize('My Post');
// throws: Slug cannot serialize this value: Invalid string: must match pattern /^[a-z-]+$/
```

Declare `scalar Slug` in your SDL (schema-first), or use `Slug` as a field
`type` (code-first), and add it to `resolvers` under its name.

## Signature

```ts
interface ZodScalarOptions {
  /** The GraphQL name, as the schema's `scalar` declaration spells it. */
  readonly name: string;
  readonly description?: string;
  /** The `@specifiedBy(url:)` of the format the scalar follows. */
  readonly specifiedByURL?: string;
  /**
   * `'integer'` refuses a float literal (`1.0`), as `Int` does; `'any'` reads
   * every literal, objects and lists included. Default `'leaf'`.
   */
  readonly literals?: 'leaf' | 'integer' | 'any';
}

function zodScalar<S extends z.ZodType, const N extends string>(
  schema: S,
  options: ZodScalarOptions<N>,
): ZodScalar<S, N>;

// what zodScalar returns: a GraphQLScalarType whose `name` is the literal N
type ZodScalar<S extends z.ZodType = z.ZodType, N extends string = string> =
  GraphQLScalarType<z.output<S>, z.input<S>> & { readonly name: N };
```

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `name` | `string` (kept as a literal type) | required | the scalar's GraphQL name, and the prefix of every error |
| `description` | `string` | none | shown in introspection |
| `specifiedByURL` | `string` | none | the `@specifiedBy(url:)` of the scalar |
| `literals` | `'leaf' \| 'integer' \| 'any'` | `'leaf'` | which query literals the scalar reads; see [Literals](#literals) |

The type parameters are `z.output<S>` (what a resolver receives) and
`z.input<S>` (what goes on the wire). `ZodScalar<S, N>` also keeps the name as
a literal: `Slug.name` is typed `'Slug'`, not `string`, so scalars can be put
in a map keyed by their name, the way the package types `pickScalars`:

```ts
import { z } from 'zod';
import { type ZodScalar, zodScalar } from '@nxgt/graphql-scalars';

const Slug = zodScalar(z.string().regex(/^[a-z-]+$/), { name: 'Slug' });

const name: 'Slug' = Slug.name;
const scalars: { Slug: ZodScalar<z.ZodString, 'Slug'> } = { Slug };
```

## Two directions

- An **input** (a variable or a literal) is *decoded* with `z.safeDecode`: the
  resolver receives `z.output<S>`.
- A **result** is *encoded* with `z.safeEncode`: the wire gets `z.input<S>`,
  checked as strictly as an input.

A schema that only validates (a regex, `z.email()`) passes the value through
both ways unchanged. Some Zod formats also normalise: `z.url()` trims and
drops tabs and line breaks, and that applies both ways. The `URL` scalar
refuses that white space first instead, so what a resolver receives is what
the client sent.

## Codecs: when the value changes

A schema that turns the wire value into another type must be a `z.codec`, so
the way out has an inverse.

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

// wire: a non-negative integer; resolvers: a bigint
export const Cents = zodScalar(
  z.codec(z.int().nonnegative(), z.bigint(), {
    decode: (n) => BigInt(n),
    encode: (b) => Number(b),
  }),
  { name: 'Cents' },
);

Cents.parseValue(120); // 120n
Cents.serialize(120n); // 120
Cents.serialize(-1n); // throws: Cents cannot serialize this value: ...
Cents.serialize(120); // 120: the wire form, read then written again
```

The encode side is checked against the wire schema too, so `-1n` is refused.

A resolver may also return the wire form. When encoding refuses a value, the
scalar decodes it as it would a client's, then encodes the result, so what goes
out is canonical either way. A value neither way takes is refused with the
encoding's message. This holds for every `zodScalar`, yours included. A codec
that normalises what it reads normalises a resolver's wire form too: with a
lowercasing decode, a resolver's `'ABC'` goes out as `'abc'`.

A plain `.transform()` has no inverse. It decodes fine, then fails when a
result is encoded. Zod throws rather than fails there, and `zodScalar` turns
that into a `GraphQLError` with Zod's error as its `originalError`:

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

const Len = zodScalar(
  z.string().transform((s) => s.length),
  { name: 'Len' },
);

Len.parseValue('abc'); // 3
Len.serialize(3);
// throws GraphQLError: Len cannot serialize this value: its schema
// transforms with no way back, use z.codec
```

Rewrite it as a codec:

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

const Trimmed = zodScalar(
  z.codec(z.string(), z.string(), {
    decode: (s) => s.trim(),
    encode: (s) => s,
  }),
  { name: 'Trimmed' },
);
```

## Literals

In a query, `at: "..."` is a literal and `at: $at` a variable. A literal is
read to a JavaScript value, then decoded like a variable:

| Literal kind | Reaches the schema as |
| --- | --- |
| `StringValue` | `string` |
| `IntValue` | `number` |
| `FloatValue` | `number` |
| `BooleanValue` | `boolean` |

Any other kind (`ListValue`, `ObjectValue`, `EnumValue`) is refused with `<Name>
cannot represent a <Kind> literal`, unless the scalar holds JSON and is made
with `literals: 'any'` (see below). A float literal for an integer schema
reaches it as `1.5` and fails the schema's own check, but `1.0` reaches it as
`1` and passes: pass `literals: 'integer'` to refuse every `FloatValue`, as
GraphQL's `Int` does. graphql-js handles `null` and a variable itself, before
the scalar sees them.

```ts
import { parseValue } from 'graphql';
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

const Slug = zodScalar(z.string().regex(/^[a-z-]+$/), { name: 'Slug' });

// graphql 17 types the second parameter (the variables) as required.
Slug.parseLiteral(parseValue('"a-b"'), undefined); // 'a-b'
Slug.parseLiteral(parseValue('[1]'), undefined);
// throws: Slug cannot represent a ListValue literal

const Quantity = zodScalar(z.int32().positive(), {
  name: 'Quantity',
  literals: 'integer',
});
Quantity.parseLiteral(parseValue('3'), undefined); // 3
Quantity.parseLiteral(parseValue('3.0'), undefined);
// throws: Quantity cannot represent a FloatValue literal
```

For a scalar whose input is an object or a list, pass `literals: 'any'`: every
literal is read, objects and lists included. An enum value arrives as its
name, and a variable inside the literal as its value; a variable left out
drops an object field and makes a list item `null`, the same on graphql 16
and 17. The schema sees the literal twice: once to validate the query, with
every variable left out, then with their values. The schema then checks the
shape, as the package's `JSON` does ([Value scalars](scalars/value.md)).

```ts
import { parseValue } from 'graphql';
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

const Settings = zodScalar(z.object({ theme: z.enum(['light', 'dark']) }), {
  name: 'Settings',
  literals: 'any',
});
Settings.parseLiteral(parseValue('{ theme: dark }'), undefined); // { theme: 'dark' }
```

## Errors

Both refusals are a `GraphQLError` whose message is `<Name> cannot ...: ` and
the **first** Zod issue:

| Message | When |
| --- | --- |
| `<Name> cannot represent this input: <issue>` | a variable or literal fails the schema |
| `<Name> cannot serialize this value: <issue>` | a resolver's result fails the schema |
| `<Name> cannot represent a <Kind> literal` | a literal of a kind that is not a string, number or boolean |

The message names the scalar and Zod's first issue, not the value — unless
your schema's issue holds it: a custom `refine` message, or a strict object's
`Unrecognized key: "<key>"`. A throw while Zod runs the schema (your codec's
own error, an async check) gives `<Name> cannot represent this input` or
`<Name> cannot serialize this value`, with the error kept as `originalError`.
graphql 16 prefixes the error of a bad variable with the value the client
sent (`Variable "$n" got invalid value …`); graphql 17 does not
(`Variable "$n" has invalid value: …`).

## graphql 16 and 17

`zodScalar` sets both families of hooks, so one scalar runs on either version:

- graphql 16 calls `serialize`, `parseValue` and `parseLiteral`.
- graphql 17 calls `coerceOutputValue`, `coerceInputValue` and
  `coerceInputLiteral`, and deprecates the first three.

Nothing to configure. `valueToLiteral` (graphql 17) is not provided; see the
[roadmap](../roadmap.md).

A scalar made with `literals: 'any'` meets two graphql 16 limits no scalar
can fix:

- A variable of another custom scalar inside its literal arrives as that
  scalar's resolver value (a `Date` for a `DateTime`); graphql 17 passes the
  wire value.
- An object or list default for one of its arguments makes `printSchema`
  throw `Cannot convert value to AST`, and an introspection query fail.

See [Value scalars](scalars/value.md) and
[troubleshooting](../troubleshooting.md#cannot-convert-value-to-ast--a-1-).

## A realistic case

A money scalar in a schema-first server:

```ts
import { createSchema } from 'graphql-yoga';
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

const Cents = zodScalar(
  z.codec(z.int().nonnegative(), z.bigint(), {
    decode: (n) => BigInt(n),
    encode: (b) => Number(b),
  }),
  { name: 'Cents', description: 'An amount in cents.' },
);

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    scalar Cents
    type Query {
      double(amount: Cents!): Cents!
    }
  `,
  resolvers: {
    Cents,
    Query: { double: (_, args: { amount: bigint }) => args.amount * 2n },
  },
});
```

