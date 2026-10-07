# Scalars

The seven scalars of the package, the exact rule of each, and how to put them
in a schema. For your own scalars see [Custom scalars](custom-scalars.md).

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

## Every rule

Every scalar checks its value both ways: an input is validated before your
resolver sees it, a result before it goes on the wire.

| GraphQL name | Export | Wire | Resolver | Accepts | Refuses |
| --- | --- | --- | --- | --- | --- |
| `DateTime` | `DateTimeScalar` | string | `Date` | `2024-03-10T12:00:00+02:00`, `2024-03-10T10:00:00Z` | no offset, impossible day, `2024-03-10` |
| `Date` | `DateScalar` | string | string | `2024-02-29` | `2023-02-29`, `2024-2-1`, a date-time, a number |
| `EmailAddress` | `EmailAddressScalar` | string | string | `ada@example.com`, `a.b+c@sub.example.org` | `ada`, `ada@`, `a b@example.com` |
| `URL` | `URLScalar` | string | string | `https://example.com/a?b=c`, `http://localhost:3000` | `javascript:`, `data:`, `mailto:`, `example.com` |
| `UUID` | `UUIDScalar` | string | string | `550e8400-e29b-41d4-a716-446655440000` | no hyphens, `not-a-uuid` |
| `NonEmptyString` | `NonEmptyStringScalar` | string | string | `a`, ` a ` | `""`, `"   "`, `"\n\t"` |
| `PositiveInt` | `PositiveIntScalar` | number | number | `1`, `2147483647` | `0`, `-1`, `1.5`, `2147483648`, `"1"` |

### DateTime

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

### Date

A calendar date, `YYYY-MM-DD`, a string on both sides. It is not a `Date`
because a `Date` is an instant: turning a birthday into one shifts it by a day
in half the time zones. An impossible day (`2021-02-30`) is refused. If you
need arithmetic, parse it yourself where the zone is known.

```ts
import { DateScalar } from '@nxgt/graphql-scalars';

DateScalar.parseValue('2024-02-29'); // '2024-02-29'
DateScalar.parseValue('2023-02-29');
// throws: Date cannot represent this input: Invalid ISO date
```

### URL

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

### PositiveInt

An integer from 1 to 2147483647. GraphQL's own `Int` is 32 bits, so this one
is too: a larger number could not be written by a client that follows the spec.
A float literal whose value is whole, such as `1.0`, is read as `1` and
accepted, where GraphQL's `Int` refuses it; `1.5` is refused.

```ts
import { PositiveIntScalar } from '@nxgt/graphql-scalars';

PositiveIntScalar.parseValue(2147483648);
// throws: PositiveInt cannot represent this input: Too big: expected number to be <=2147483647
```

### EmailAddress, UUID, NonEmptyString

`EmailAddress` is `z.email()`, `UUID` is `z.uuid()` and `NonEmptyString` is a
string with at least one non-white-space character (`" a "` is kept as it is,
not trimmed).

## Signatures

```ts
const DateTimeScalar: GraphQLScalarType<Date, string>;
const DateScalar: GraphQLScalarType<string, string>;
const EmailAddressScalar: GraphQLScalarType<string, string>;
const URLScalar: GraphQLScalarType<string, string>;
const UUIDScalar: GraphQLScalarType<string, string>;
const NonEmptyStringScalar: GraphQLScalarType<string, string>;
const PositiveIntScalar: GraphQLScalarType<number, number>;

const scalarResolvers: {
  DateTime: typeof DateTimeScalar;
  Date: typeof DateScalar;
  EmailAddress: typeof EmailAddressScalar;
  URL: typeof URLScalar;
  UUID: typeof UUIDScalar;
  NonEmptyString: typeof NonEmptyStringScalar;
  PositiveInt: typeof PositiveIntScalar;
};
const scalarTypeDefs: string; // one `scalar X @specifiedBy(...)` line per scalar
```

`EmailAddress`, `NonEmptyString` and `PositiveInt` have no `specifiedBy`; the
others point at RFC 3339, the WHATWG URL standard and RFC 9562.

## Schema-first with a server

Declare once with `scalarTypeDefs`, bind with `scalarResolvers`; spread both whole, so every scalar a resolver names is declared.

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

## The same rules outside GraphQL

`schemas` exports the Zod schema of each scalar: `dateTime` (a codec between
the wire string and a `Date`), `date`, `emailAddress`, `url`, `uuid`,
`nonEmptyString`, `positiveInt`.

```ts
import { z } from 'zod';
import { schemas } from '@nxgt/graphql-scalars';

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
