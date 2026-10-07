# @nxgt/graphql-scalars

Ready-made GraphQL scalars (`DateTime`, `Date`, `EmailAddress`, `URL`, `UUID`,
`NonEmptyString`, `PositiveInt`) whose every rule is a Zod schema, and
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

| GraphQL name | Export | Wire value | Resolver value | Rule |
| --- | --- | --- | --- | --- |
| `DateTime` | `DateTimeScalar` | string | `Date` | RFC 3339 with an offset (`Z` or `±hh:mm`); written in UTC |
| `Date` | `DateScalar` | string | string | `YYYY-MM-DD`, a real calendar day |
| `EmailAddress` | `EmailAddressScalar` | string | string | Zod's `z.email()` |
| `URL` | `URLScalar` | string | string | absolute `http:` or `https:` URL |
| `UUID` | `UUIDScalar` | string | string | `z.uuid()`, the 8-4-4-4-12 form |
| `NonEmptyString` | `NonEmptyStringScalar` | string | string | at least one non-white-space character |
| `PositiveInt` | `PositiveIntScalar` | number | number | integer from 1 to 2147483647 |

Each rule in detail is in [Scalars](docs/guide/scalars.md).

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

`scalarTypeDefs` declares all seven scalars (with their `@specifiedBy`) and
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

`schemas` holds the Zod schema behind each scalar: validate a form or a REST
body with the rule the API uses.

```ts
import { z } from 'zod';
import { schemas } from '@nxgt/graphql-scalars';

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

The message names the scalar and Zod's first issue. For the seven scalars here
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

## Documentation

- [Documentation index](docs/README.md)
- Guides: [Scalars](docs/guide/scalars.md),
  [Custom scalars](docs/guide/custom-scalars.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
