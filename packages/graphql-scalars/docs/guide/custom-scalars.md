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
drops tabs and line breaks, and that applies both ways.

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
```

The encode side is checked against the wire schema too, so `-1n` is refused.

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

Any other kind (`ListValue`, `ObjectValue`, `EnumValue`) is
refused with `<Name> cannot represent a <Kind> literal`. A float literal for an
integer schema reaches it as `1.5` and fails the schema's own check. graphql-js
handles `null` and a variable itself, before the scalar sees them.

```ts
import { parseValue } from 'graphql';
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

const Slug = zodScalar(z.string().regex(/^[a-z-]+$/), { name: 'Slug' });

// graphql 17 types the second parameter (the variables) as required.
Slug.parseLiteral(parseValue('"a-b"'), undefined); // 'a-b'
Slug.parseLiteral(parseValue('[1]'), undefined);
// throws: Slug cannot represent a ListValue literal
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

Nothing to configure. `valueToLiteral` (graphql 17) is not provided; see the [roadmap](../roadmap.md).

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

