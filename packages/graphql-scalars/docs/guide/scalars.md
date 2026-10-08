# Scalars

The scalars of the package, grouped by category, the exact rule of each, and
how to put them in a schema. For your own scalars see [Custom scalars](custom-scalars.md).

## The smallest example

```ts
import { graphql, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { DateTimeScalar } from '@nxgt/graphql-scalars';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      next: {
        type: DateTimeScalar,
        args: { at: { type: DateTimeScalar } },
        resolve: (_, args: { at: Date }) => new Date(args.at.getTime() + 1000),
      },
    },
  }),
});

const result = await graphql({
  schema,
  source: '{ next(at: "2024-01-01T01:00:00+01:00") }',
});
// { data: { next: '2024-01-01T00:00:01.000Z' } }
```

## Every scalar

Every scalar checks its value both ways: an input is validated before your
resolver sees it, a result before it goes on the wire.

Scalars live in categories, and the page follows them. A scalar `X` is
exported as `XScalar`, its Zod schema as `xSchema`, and that schema is also
`schemas.x`.

| Category | Scalars |
| --- | --- |
| [date-time](scalars/date-time.md) | `DateTime`, `Timestamp`, `Date`, `Time`, `LocalTime`, `LocalDateTime`, `Duration`, `UtcOffset`, `TimeZone` |
| [encoding](scalars/encoding.md) | `Base64`, `Base64URL`, `Hexadecimal`, `JWT`, `SHA256`, `SHA512` |
| [identifier](scalars/identifier.md) | `UUID`, `UUIDv4`, `UUIDv7`, `GUID`, `ULID`, `Cuid2`, `NanoID`, `KSUID`, `XID`, `ObjectID`, `ISBN`, `SemVer` |
| [color](scalars/color.md) | `HexColorCode`, `RGB`, `RGBA`, `HSL`, `HSLA` |
| [finance](scalars/finance.md) | `IBAN`, `Currency` |
| [geo](scalars/geo.md) | `Latitude`, `Longitude` |
| [locale](scalars/locale.md) | `CountryCode`, `Locale` |
| [network](scalars/network.md) | `URL`, `EmailAddress`, `IPv4`, `IPv6`, `IP`, `CIDRv4`, `CIDRv6`, `MAC`, `Hostname`, `PhoneNumber` |
| [number](scalars/number.md) | `PositiveInt`, `NegativeInt`, `NonNegativeInt`, `NonPositiveInt`, `PositiveFloat`, `NegativeFloat`, `NonNegativeFloat`, `NonPositiveFloat`, `SafeInt`, `Port`, `Long`, `BigInt` |
| [string](scalars/string.md) | `NonEmptyString`, `Emoji` |
| [value](scalars/value.md) | `JSON`, `JSONObject`, `Void` |


## Signatures

```ts
// every scalar has this shape, `X` being its GraphQL name
const XScalar: ZodScalar<typeof xSchema, 'X'>; // GraphQLScalarType<Output, Input>
// DateTime: GraphQLScalarType<Date, string>; Timestamp: <Date, number>; PositiveInt: <number, number>;
// Long, BigInt: <bigint, string | number>; the others: <string, string>

// every scalar, keyed by its GraphQL name
type ScalarResolvers = { DateTime: typeof DateTimeScalar /* , Date, ... */ };
type ScalarName = keyof ScalarResolvers;
// every schema, keyed by its export name without `Schema`
type Schemas = { dateTime: typeof dateTimeSchema /* , date, ... */ };

const scalarResolvers: ScalarResolvers;
const schemas: Schemas;
const scalarTypeDefs: string; // one `scalar X @specifiedBy(...)` line per scalar
```

`scalarTypeDefs` and `scalarResolvers` list the scalars in alphabetical order
of their export.

A scalar with a standard behind it has a `specifiedBy` pointing at it (RFC 3339
for `DateTime`, the WHATWG URL standard for `URL`, RFC 4291 for `IPv6`); the
category pages name the exports and rules of each, and the SDL of
`scalarTypeDefs` shows which have one.

## Schema-first with a server

Declare once with `scalarTypeDefs`, bind with `scalarResolvers`; spread both whole, so every scalar a resolver names is declared. To declare only some, use [`pickScalars`](#pickscalars).

```ts
import { createSchema } from 'graphql-yoga';
import { scalarTypeDefs, scalarResolvers } from '@nxgt/graphql-scalars';

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    ${scalarTypeDefs}
    type Query {
      user(id: UUID!): User
    }
    type User {
      id: UUID!
      email: EmailAddress!
      homepage: URL
      joined: DateTime!
    }
  `,
  resolvers: {
    ...scalarResolvers,
    Query: {
      user: (_, args: { id: string }) => ({
        id: args.id,
        email: 'ada@example.com',
        homepage: null,
        joined: new Date(),
      }),
    },
  },
});
```

## pickScalars

`pickScalars(...names)` returns the SDL and the `resolvers` entries of the
named scalars only, for a schema-first server that does not want every scalar
in its SDL.

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('UUID', 'EmailAddress');

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Query {
        owner(id: UUID!): EmailAddress
      }
    `,
  ],
  resolvers: { ...resolvers, Query: { owner: () => 'ada@example.com' } },
});
```

```ts
function pickScalars<const N extends readonly ScalarName[]>(
  ...names: N
): {
  readonly typeDefs: string;
  readonly resolvers: Pick<ScalarResolvers, N[number]>;
};
```

| Call | Result |
| --- | --- |
| `pickScalars('DateTime', 'URL')` | `typeDefs` is `scalar DateTime @specifiedBy(...)` and `scalar URL @specifiedBy(...)`, in the order given; `resolvers` has those two keys |
| `pickScalars()` | `{ typeDefs: '', resolvers: {} }` |
| `pickScalars('URL', 'URL')` | `URL` declared once |
| `pickScalars('Datetime')` | does not compile (`TS2345`): not a `ScalarName` |
| a name that got past the compiler | throws `TypeError: pickScalars: no scalar is named "Datetime". The names are Date, DateTime, ….` |

`resolvers` is typed by the names you pass, so `resolvers.URL` exists and
`resolvers.UUID` does not. Declare in your own SDL only the scalars you
picked: a field typed with another one fails when the schema is built.

## The same rules outside GraphQL

Each scalar's Zod schema is exported on its own, named in its heading above
(`dateTimeSchema` is a codec between the wire string and a `Date`), and
`schemas` holds them all under the name without `Schema`: `schemas.dateTime`
is `dateTimeSchema`.

```ts
import { z } from 'zod';
import { emailAddressSchema, schemas } from '@nxgt/graphql-scalars';

emailAddressSchema.parse('ada@example.com'); // 'ada@example.com'

const body = z.object({
  email: schemas.emailAddress,
  site: schemas.url.optional(),
  at: schemas.dateTime,
});

const parsed = body.parse({
  email: 'ada@example.com',
  at: '2024-03-10T12:00:00Z',
}); // parsed.at is a Date
```

Next: [Custom scalars](custom-scalars.md), or [Migrating from graphql-scalars](migrating-from-graphql-scalars.md).
