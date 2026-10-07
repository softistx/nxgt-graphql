# @nxgt/graphql-scalars

Ready-made GraphQL scalars, by category (dates and times, encodings,
identifiers, network, numbers, strings), whose every rule is a Zod schema, and
`zodScalar` to turn any Zod schema of your own into one. An input is decoded
into the value your resolver receives; a resolver's result is encoded and
checked on the way out as strictly as on the way in. It works with `graphql`
16 and 17, code-first or schema-first.

## Install

```sh
bun add @nxgt/graphql-scalars graphql zod typescript
```

Peers, all **required** (`typescript` because the scalars' value types are
the Zod schemas' `z.input` and `z.output`, inferred by the compiler):

| Peer | Range |
| --- | --- |
| `graphql` | `^16.11.0 \|\| ^17.0.0` |
| `zod` | `>=4.6.5 <5` |
| `typescript` | `^6.0.3` |

Your `tsconfig.json` needs:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler" // `nodenext` is not supported
  }
}
```

## The scalars

Scalars are grouped in categories. Each one `X` is exported as `XScalar`
(`DateTimeScalar`) and its Zod schema as `xSchema` (`dateTimeSchema`).

| Category | Scalars |
| --- | --- |
| [date-time](docs/guide/scalars/date-time.md) | 2: `DateTime`, `Date` |
| [encoding](docs/guide/scalars/encoding.md) | 6: `Base64`, `Base64URL`, `Hexadecimal`, `JWT`, `SHA256`, `SHA512` |
| [identifier](docs/guide/scalars/identifier.md) | 12: `UUID`, `UUIDv7`, `ULID`, `ObjectID`, `ISBN`, `SemVer` and 6 more |
| [network](docs/guide/scalars/network.md) | 10: `URL`, `EmailAddress`, `IPv4`, `IPv6`, `MAC` and 5 more |
| [number](docs/guide/scalars/number.md) | 12: `PositiveInt`, `SafeInt`, `Port`, `Long`, `BigInt` and the signed Int and Float variants |
| [string](docs/guide/scalars/string.md) | 1: `NonEmptyString` |

The rule, the accepted and refused values and the exports of each scalar are
in the [Scalars reference](docs/guide/scalars.md).

## Usage

### Code-first

```ts
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { DateTimeScalar, PositiveIntScalar } from '@nxgt/graphql-scalars';

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      later: {
        type: DateTimeScalar,
        args: {
          at: { type: DateTimeScalar },
          days: { type: PositiveIntScalar },
        },
        // `at` is a Date: DateTime decoded it.
        resolve: (_, args: { at: Date; days: number }) =>
          new Date(args.at.getTime() + args.days * 86_400_000),
      },
    },
  }),
});
```

### Schema-first

`scalarTypeDefs` declares every scalar (with its `@specifiedBy`) and
`scalarResolvers` binds them.

```ts
import { makeExecutableSchema } from '@graphql-tools/schema';
import { scalarResolvers, scalarTypeDefs } from '@nxgt/graphql-scalars';

export const schema = makeExecutableSchema({
  typeDefs: [
    scalarTypeDefs,
    /* GraphQL */ `
      type Query {
        later(at: DateTime!, days: PositiveInt!): DateTime!
      }
    `,
  ],
  resolvers: {
    ...scalarResolvers,
    Query: {
      later: (_, args: { at: Date; days: number }) =>
        new Date(args.at.getTime() + args.days * 86_400_000),
    },
  },
});
```

GraphQL Yoga's `createSchema` takes the same `typeDefs` and `resolvers`.

### Some of the scalars

`pickScalars(...names)` returns the `typeDefs` and `resolvers` of the named
scalars only, so the SDL declares just what the schema uses. The names are
checked by the compiler (`ScalarName`) and again at run time.

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('DateTime', 'URL');

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Query {
        visit(url: URL!): DateTime!
      }
    `,
  ],
  resolvers: {
    ...resolvers,
    Query: { visit: () => new Date() },
  },
});
```

An unknown name throws a `TypeError`; no names gives
`{ typeDefs: '', resolvers: {} }`; a name given twice is declared once. See
[Scalars](docs/guide/scalars.md#pickscalars).

### Your own scalar

`zodScalar(schema, { name, description?, specifiedByURL? })` makes a scalar
from any Zod schema. A schema that only validates needs nothing more; one that
**changes** the value on the way in must be a `z.codec`, so the way out exists.

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const Slug = zodScalar(z.string().regex(/^[a-z-]+$/), { name: 'Slug' });

// wire: a non-negative integer; resolvers: a bigint
export const Cents = zodScalar(
  z.codec(z.int().nonnegative(), z.bigint(), {
    decode: (n) => BigInt(n),
    encode: (b) => Number(b),
  }),
  { name: 'Cents' },
);
```

See [Custom scalars](docs/guide/custom-scalars.md).

### The same rules outside GraphQL

`schemas` holds the Zod schema behind each scalar, and each one is also
exported on its own (`emailAddressSchema`, `dateSchema`, …): validate a form or
a REST body with the rule the API uses.

```ts
import { z } from 'zod';
import { emailAddressSchema, schemas } from '@nxgt/graphql-scalars';

emailAddressSchema.parse('ada@example.com'); // same schema as schemas.emailAddress

const signUp = z.object({
  email: schemas.emailAddress,
  birthday: schemas.date,
});

type SignUp = z.output<typeof signUp>; // { email: string; birthday: string }
```

## Errors

A refusal is a `GraphQLError`:

- `<Name> cannot represent this input: <zod issue>` for a variable or a literal;
- `<Name> cannot serialize this value: <zod issue>` for a resolver's result;
- `<Name> cannot represent a <Kind> literal` for a list, object or enum literal.

The message names the scalar and Zod's first issue. For the scalars here
the issue never contains the value, so a resolver's bad result does not leak
to the client; a schema of your own can put input in its issue (a custom
message, a strict object's `Unrecognized key`). graphql 16 prefixes a bad
**variable**'s error with the value the client sent, graphql 17 does not:

- graphql 16: `Variable "$n" got invalid value -3; PositiveInt cannot represent this input: Too small: expected number to be >0`
- graphql 17: `Variable "$n" has invalid value: PositiveInt cannot represent this input: Too small: expected number to be >0`

Every message is in [Troubleshooting](docs/troubleshooting.md).

## Traps

- A scalar with a plain `.transform()` decodes fine and then fails when a
  result is encoded; use `z.codec`.
- `DateTime` serializes a `Date` only: parse a stored string before returning it.
- `Date` is a string on both sides, never a `Date` object.
- `Long` and `BigInt` are a `bigint` in resolvers and always a string on the
  wire: return `BigInt(row.count)`, not a `number`.

## Documentation

- [Documentation index](docs/README.md)
- Guides: [Scalars](docs/guide/scalars.md),
  [Custom scalars](docs/guide/custom-scalars.md),
  [Migrating from graphql-scalars](docs/guide/migrating-from-graphql-scalars.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
