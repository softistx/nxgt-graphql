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
| [number](#number) | `PositiveInt`, `NegativeInt`, `NonNegativeInt`, `NonPositiveInt`, `PositiveFloat`, `NegativeFloat`, `NonNegativeFloat`, `NonPositiveFloat`, `SafeInt`, `Port`, `Long`, `BigInt` |
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

Integers of 32 bits (as GraphQL's `Int`), finite floats, then the integers
beyond 32 bits. A float refuses `NaN` and `Infinity`.

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

### `NegativeInt`

Export `NegativeIntScalar`, schema `negativeIntSchema`. A number on both
sides. An integer from -2147483648 to -1; refuses `0` and `1`.

### `NonNegativeInt`

Export `NonNegativeIntScalar`, schema `nonNegativeIntSchema`. A number on both
sides. An integer from 0 to 2147483647; refuses `-1`.

### `NonPositiveInt`

Export `NonPositiveIntScalar`, schema `nonPositiveIntSchema`. A number on both
sides. An integer from -2147483648 to 0; refuses `1`.

### `PositiveFloat`

Export `PositiveFloatScalar`, schema `positiveFloatSchema`. A number on both
sides. A finite number above 0: accepts `0.5`; refuses `0`, `-0.5`, `NaN` and
`Infinity`.

### `NegativeFloat`

Export `NegativeFloatScalar`, schema `negativeFloatSchema`. A number on both
sides. A finite number below 0: accepts `-0.5`; refuses `0`.

### `NonNegativeFloat`

Export `NonNegativeFloatScalar`, schema `nonNegativeFloatSchema`. A number on
both sides. A finite number, 0 or above: accepts `0` and `1.5`; refuses `-0.5`.

### `NonPositiveFloat`

Export `NonPositiveFloatScalar`, schema `nonPositiveFloatSchema`. A number on
both sides. A finite number, 0 or below: accepts `0` and `-1.5`; refuses `0.5`.

### `SafeInt`

Export `SafeIntScalar`, schema `safeIntSchema`. A number on both sides.
Accepts `-9007199254740991` and `9007199254740991`; refuses `9007199254740992`
and `1.5`.

An integer JavaScript holds exactly, ±(2^53 - 1). It is beyond 32 bits, so it
is not GraphQL's `Int`: a client that follows the spec cannot write it as a
literal. Past 2^53 use `Long` or `BigInt`.

```ts
import { SafeIntScalar } from '@nxgt/graphql-scalars';

SafeIntScalar.parseValue(9007199254740992);
// throws: SafeInt cannot represent this input: Too big: expected int to be <=9007199254740991
```

### `Port`

Export `PortScalar`, schema `portSchema`. A number on both sides. A TCP or UDP
port, 0 to 65535; refuses `-1`, `65536` and `80.5`.

```ts
import { PortScalar } from '@nxgt/graphql-scalars';

PortScalar.parseValue(65536);
// throws: Port cannot represent this input: Too big: expected number to be <=65535
```

### `Long`

Export `LongScalar`, schema `longSchema`. A `bigint` in resolvers, a decimal
string on the wire. A signed 64-bit integer, -9223372036854775808 to
9223372036854775807.

JSON numbers past 2^53 lose precision in most clients, so the way **out** is
always a string, whatever the size. The way in accepts a canonical decimal
string (no leading zero, no `-0`, no `+`, no spaces) or a safe-integer number.

```ts
import { LongScalar } from '@nxgt/graphql-scalars';

LongScalar.parseValue('9223372036854775807'); // 9223372036854775807n
LongScalar.parseValue(42); // 42n
LongScalar.serialize(-9223372036854775808n); // '-9223372036854775808'

LongScalar.parseValue('007');
// throws: Long cannot represent this input: Expected a decimal integer, with no leading zero and no "-0"
LongScalar.parseValue(1.5);
// throws: Long cannot represent this input: Expected a decimal integer string or a safe integer
LongScalar.parseValue('9223372036854775808');
// throws: Long cannot represent this input: Too big: expected bigint to be <=9223372036854775807
```

A resolver must return a `bigint`; a `number` is refused
(`BigInt(row.count)` fixes it, see [Troubleshooting](../troubleshooting.md)).
In a query, a literal past 2^53 written as a number is refused, not rounded:
write it as a string, `"9223372036854775807"`, or pass a variable.

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('Long');

export const schema = createSchema({
  typeDefs: [typeDefs, /* GraphQL */ `type Query { views(id: ID!): Long! }`],
  resolvers: { ...resolvers, Query: { views: () => 9007199254740993n } },
});
// { data: { views: '9007199254740993' } }
```

### `BigInt`

Export `BigIntScalar`, schema `bigIntSchema`. The same as `Long` with no
range: an integer of any size, a `bigint` in resolvers and a decimal string on
the wire.

```ts
import { BigIntScalar } from '@nxgt/graphql-scalars';

BigIntScalar.parseValue('123456789012345678901234567890'); // a bigint
BigIntScalar.serialize(2n ** 80n); // '1208925819614629174706176'
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
// NegativeInt, NonNegativeInt, NonPositiveInt, the four floats, SafeInt and Port: the same shape
const LongScalar: ZodScalar<typeof longSchema, 'Long'>; // GraphQLScalarType<bigint, string | number>
const BigIntScalar: ZodScalar<typeof bigIntSchema, 'BigInt'>; // GraphQLScalarType<bigint, string | number>

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

Only `DateTime`, `Date`, `URL` and `UUID` have a `specifiedBy`, pointing at
RFC 3339, the WHATWG URL standard and RFC 9562; the others have none.

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
`urlSchema`; `uuidSchema`; `nonEmptyStringSchema`; `positiveIntSchema`, `longSchema`, …), and
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
