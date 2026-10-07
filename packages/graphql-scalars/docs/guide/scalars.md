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
| [date-time](#date-time) | `DateTime`, `Date` |
| [identifier](#identifier) | `UUID` |
| [network](#network) | `URL`, `EmailAddress` |
| [number](#number) | `PositiveInt` |
| [string](#string) | `NonEmptyString` |

## date-time

### `DateTime`

Export `DateTimeScalar`, schema `dateTimeSchema`. Wire value a string,
resolver value a `Date`. Accepts `2024-03-10T12:00:00+02:00` and
`2024-03-10T10:00:00Z`; refuses a time with no offset, an impossible day and
`2024-03-10`.

An RFC 3339 date-time **with its offset** (`Z` or `±hh:mm`). A time without an
offset names no instant, so it is refused. A variable becomes a `Date`; the
way out calls `toISOString()`, so the wire value is always UTC, to the
millisecond: `…00.123456789Z` comes back as `…00.123Z`. A `Date` before year
0 or after 9999 has no RFC 3339 form and is refused on the way out.

```ts
import { DateTimeScalar } from '@nxgt/graphql-scalars';

const date = DateTimeScalar.parseValue('2024-03-10T12:00:00+02:00'); // Date
DateTimeScalar.serialize(date); // '2024-03-10T10:00:00.000Z'

DateTimeScalar.parseValue('2024-03-10T12:00:00');
// throws: DateTime cannot represent this input: Invalid ISO datetime
```

It serializes a `Date` **only**. A resolver that returns the string it read
from a database, without parsing it, is refused:

```ts
import { DateTimeScalar } from '@nxgt/graphql-scalars';

DateTimeScalar.serialize('2024-03-10T10:00:00.000Z');
// throws: DateTime cannot serialize this value: Invalid input: expected date, received string

DateTimeScalar.serialize(new Date('2024-03-10T10:00:00.000Z')); // fine
```

An invalid `Date` (`new Date(Number.NaN)`) is refused too.

### `Date`

Export `DateScalar`, schema `dateSchema`. A string on both sides. Accepts
`2024-02-29`; refuses `2023-02-29`, `2024-2-1`, a date-time and a number.

A calendar date, `YYYY-MM-DD`. It is not a `Date`
because a `Date` is an instant: turning a birthday into one shifts it by a day
in half the time zones. An impossible day (`2021-02-30`) is refused. If you
need arithmetic, parse it yourself where the zone is known.

```ts
import { DateScalar } from '@nxgt/graphql-scalars';

DateScalar.parseValue('2024-02-29'); // '2024-02-29'
DateScalar.parseValue('2023-02-29');
// throws: Date cannot represent this input: Invalid ISO date
```

## identifier

### `UUID`

Export `UUIDScalar`, schema `uuidSchema`. A string on both sides. Accepts
`550e8400-e29b-41d4-a716-446655440000`; refuses a value with no hyphens and
`not-a-uuid`.

It is `z.uuid()`, the 8-4-4-4-12 form (RFC 9562).

## network

### `URL`

Export `URLScalar`, schema `urlSchema`. A string on both sides. Accepts
`https://example.com/a?b=c` and `http://localhost:3000`; refuses
`javascript:`, `data:`, `mailto:` and `example.com`.

An absolute `http:` or `https:` URL, and nothing else. `javascript:` and
`data:` URLs are refused because a client is likely to put the value in an
`href`, which makes them a script-injection vector. As with `z.url()`, the
value is trimmed and tabs and line breaks are dropped, both ways:
`' https://x.com\n'` is `'https://x.com'`.

```ts
import { URLScalar } from '@nxgt/graphql-scalars';

URLScalar.parseValue('https://example.com/a?b=c'); // fine
URLScalar.parseValue('javascript:alert(1)');
// throws: URL cannot represent this input: Invalid URL
```

### `EmailAddress`

Export `EmailAddressScalar`, schema `emailAddressSchema`. A string on both
sides. Accepts `ada@example.com` and `a.b+c@sub.example.org`; refuses `ada`,
`ada@` and `a b@example.com`.

It is `z.email()`.

## number

### `PositiveInt`

Export `PositiveIntScalar`, schema `positiveIntSchema`. A number on both
sides. Accepts `1` and `2147483647`; refuses `0`, `-1`, `1.5`, `2147483648`
and `"1"`.

An integer from 1 to 2147483647. GraphQL's own `Int` is 32 bits, so this one
is too: a larger number could not be written by a client that follows the spec.
A float literal whose value is whole, such as `1.0`, is read as `1` and
accepted, where GraphQL's `Int` refuses it; `1.5` is refused.

```ts
import { PositiveIntScalar } from '@nxgt/graphql-scalars';

PositiveIntScalar.parseValue(2147483648);
// throws: PositiveInt cannot represent this input: Too big: expected number to be <=2147483647
```

## string

### `NonEmptyString`

Export `NonEmptyStringScalar`, schema `nonEmptyStringSchema`. A string on both
sides. Accepts `a` and ` a `; refuses `""`, `"   "` and `"\n\t"`.

A string with at least one non-white-space character; `" a "` is kept as it
is, not trimmed.

## Signatures

```ts
const DateTimeScalar: ZodScalar<typeof dateTimeSchema, 'DateTime'>; // GraphQLScalarType<Date, string>
const DateScalar: ZodScalar<typeof dateSchema, 'Date'>; // GraphQLScalarType<string, string>
const EmailAddressScalar: ZodScalar<typeof emailAddressSchema, 'EmailAddress'>;
const URLScalar: ZodScalar<typeof urlSchema, 'URL'>;
const UUIDScalar: ZodScalar<typeof uuidSchema, 'UUID'>;
const NonEmptyStringScalar: ZodScalar<typeof nonEmptyStringSchema, 'NonEmptyString'>;
const PositiveIntScalar: ZodScalar<typeof positiveIntSchema, 'PositiveInt'>; // GraphQLScalarType<number, number>

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
of their export: `Date`, `DateTime`, `EmailAddress`, `NonEmptyString`,
`PositiveInt`, `URL`, `UUID`.

`EmailAddress`, `NonEmptyString` and `PositiveInt` have no `specifiedBy`; the
others point at RFC 3339, the WHATWG URL standard and RFC 9562.

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

Each scalar's Zod schema is exported on its own (`dateTimeSchema`, a codec
between the wire string and a `Date`; `dateSchema`; `emailAddressSchema`;
`urlSchema`; `uuidSchema`; `nonEmptyStringSchema`; `positiveIntSchema`), and
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

Next: [Custom scalars](custom-scalars.md).
