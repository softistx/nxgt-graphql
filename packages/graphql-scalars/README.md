# @nxgt/graphql-scalars

Ready-made GraphQL scalars, by category (colors, dates and times, encodings,
finance, geo, identifiers, locale, network, numbers, strings, values), whose
every rule is a Zod schema, and `zodScalar` to turn any Zod schema of your own
into one. An input is decoded into the value your resolver receives; a
resolver's result is encoded and checked on the way out as strictly as on the
way in. It works with `graphql` 16 and 17, code-first or schema-first.

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
| [date-time](docs/guide/scalars/date-time.md) | 9: `DateTime`, `Timestamp`, `Date`, `Duration`, `TimeZone` and 4 more |
| [encoding](docs/guide/scalars/encoding.md) | 6: `Base64`, `Base64URL`, `Hexadecimal`, `JWT`, `SHA256`, `SHA512` |
| [identifier](docs/guide/scalars/identifier.md) | 12: `UUID`, `UUIDv7`, `ULID`, `ObjectID`, `ISBN`, `SemVer` and 6 more |
| [color](docs/guide/scalars/color.md) | 5: `HexColorCode`, `RGB`, `RGBA`, `HSL`, `HSLA` |
| [finance](docs/guide/scalars/finance.md) | 2: `IBAN`, `Currency` |
| [geo](docs/guide/scalars/geo.md) | 2: `Latitude`, `Longitude` |
| [locale](docs/guide/scalars/locale.md) | 2: `CountryCode`, `Locale` |
| [network](docs/guide/scalars/network.md) | 10: `URL`, `EmailAddress`, `IPv4`, `IPv6`, `MAC` and 5 more |
| [number](docs/guide/scalars/number.md) | 12: `PositiveInt`, `SafeInt`, `Port`, `Long`, `BigInt` and the signed Int and Float variants |
| [string](docs/guide/scalars/string.md) | 2: `NonEmptyString`, `Emoji` |
| [value](docs/guide/scalars/value.md) | 3: `JSON`, `JSONObject`, `Void` |

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

### The SDL as a file

An IDE's GraphQL plugin (JetBrains GraphQL, VS Code GraphQL) and a server that
scans `*.graphql(s)` files read files, not `scalarTypeDefs`. The package ships
the SDL of every scalar as one, and a bin that writes it:

```yaml
# graphql.config.yml
schema:
  - src/**/*.graphql
  - node_modules/@nxgt/graphql-scalars/graphql/scalars.graphqls
```

```sh
bunx nxgt-graphql-scalars typedefs                        # print every scalar
bunx nxgt-graphql-scalars typedefs DateTime URL           # only these
bunx nxgt-graphql-scalars typedefs --out                  # generated/graphql/scalars.graphqls
bunx nxgt-graphql-scalars typedefs DateTime --out schema/scalars.graphqls
# or: npx nxgt-graphql-scalars typedefs ... (installed locally; else
#     npx -p @nxgt/graphql-scalars nxgt-graphql-scalars typedefs)
```

`--out` with no file writes `generated/graphql/scalars.graphqls`, relative to
the current directory; the folder is created. With names, the SDL is
`pickScalars(...names).typeDefs`, and an unknown name exits 2 with its error,
which lists the names. The exit code is 0 when done, 1 when the file cannot be
written (`typedefs failed: <message>` on stderr) and 2 on a usage error.
Regenerate the copy after upgrading the package.

The schema must declare each scalar once. Pick one source for the server:

- **The generated file is part of your schema.** If the server scans
  `*.graphql(s)` files and the copy sits among them, it already declares the
  scalars: drop the `scalarTypeDefs` import (keep `scalarResolvers`).
- **`scalarTypeDefs` declares them.** Then the copy is for the IDE only: keep
  it out of the folders the server scans, or exclude it from the glob.

Both at once declare every scalar twice: `buildSchema` throws
`There can be only one type named "DateTime".` (see
[Troubleshooting](docs/troubleshooting.md)).

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

`scalarSchemas` holds the same schemas keyed by GraphQL name, for code
generated from a GraphQL schema (`@nxgt/graphql-codegen-zod` reads it), and
each scalar `zodScalar` returns carries its own as `.schema` (a type rebuilt
from its config, as `mapSchema` does, has none):

```ts
import { z } from 'zod';
import { DateTimeScalar, scalarSchemas } from '@nxgt/graphql-scalars';

scalarSchemas.UUID; // uuidSchema, typed exactly
z.decode(scalarSchemas.DateTime, '2024-03-10T12:00:00Z'); // a Date, as the resolver gets it
DateTimeScalar.schema === scalarSchemas.DateTime; // true
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
- `URL` takes `http:` and `https:` only and refuses white space, user info and
  a Unicode host rather than rewriting them: send `https://xn--bcher-kva.example`,
  not `https://bücher.example`.
- `Long` and `BigInt` are a `bigint` in resolvers and always a string on the
  wire: return `BigInt(row.count)`, not a `number`.

## Documentation

- [Documentation index](docs/README.md)
- Guides: [Scalars](docs/guide/scalars.md),
  [Custom scalars](docs/guide/custom-scalars.md),
  [Migrating from graphql-scalars](docs/guide/migrating-from-graphql-scalars.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
