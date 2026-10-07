# Migrating from graphql-scalars

For someone moving from the `graphql-scalars` package (The Guild): which names
keep their rule here, which keep the name but change the rule, which are
aliases, and which are not here. The list grows as categories land; see the
[Roadmap](../roadmap.md).

```ts
// before
import { GraphQLPositiveInt } from 'graphql-scalars';
// after
import { PositiveIntScalar } from '@nxgt/graphql-scalars';
```

A scalar `X` here is exported as `XScalar`, and the rules are Zod schemas
(`xSchema`). See [Scalars](scalars.md).

## Same name, same rule

| Name | Notes |
| --- | --- |
| `EmailAddress` | a string |
| `UUID` | a string |
| `Hexadecimal` | one or more hex digits, any case, kept as sent, no `0x`; only the messages differ (`Expected at least one hexadecimal digit` or `Invalid hex` here, `Value is not a valid hexadecimal value: …` there) |
| `NonEmptyString` | a string |
| `PositiveInt` | 1 to 2147483647 |
| `NegativeInt` | -2147483648 to -1 |
| `NonNegativeInt` | 0 to 2147483647 |
| `NonPositiveInt` | -2147483648 to 0 |
| `PositiveFloat` | a finite number above 0 |
| `NegativeFloat` | a finite number below 0 |
| `NonNegativeFloat` | a finite number, 0 or above |
| `NonPositiveFloat` | a finite number, 0 or below |
| `SafeInt` | ±(2^53 - 1) |

## Same name, different rule

- **`Date`** is a string `YYYY-MM-DD` on both sides. In graphql-scalars 2.0.0
  `Date` is a JavaScript `Date` object, and its `YYYY-MM-DD` string scalar is
  `LocalDate`.
- **`Port`** is 0 to 65535 here. graphql-scalars describes 0 to 65535 but
  refuses `0`; this one accepts it.
- **`DateTime`** (a `Date` in resolvers, as in graphql-scalars) requires an offset (`Z` or `±hh:mm`) and resolves to a
  `Date`, serialized in UTC. A time with no offset is refused.
- **`URL`** is `http` and `https` only and stays a string; there is no `URL`
  object in resolvers.
- **`Long` and `BigInt`** are a `bigint` in resolvers and always a decimal
  string on the wire. A resolver returning a `number` is refused. Input
  accepts a canonical decimal string or a safe-integer number; a literal past
  2^53 written as a number is refused, so write it as a string.
  graphql-scalars serializes a safe value as a JSON number; here the result is
  always a string, so a client that reads numbers must parse it
  (`BigInt(data.views)`).
- **`IPv4`** refuses a leading zero (`01.2.3.4`) and a `/prefix`;
  graphql-scalars accepts both (its regex allows `0?0?` before each part and an
  optional `/0` to `/32`). Use `CIDRv4` for a block.
- **`IPv6`** refuses a `/prefix`, which graphql-scalars accepts; use `CIDRv6`.
  Both refuse a zone. Neither normalises the value.
- **`IP`** follows its two parts, so it refuses an address with a prefix and an
  IPv4 with a leading zero.
- **`MAC`** is six hex pairs separated by `:`, all lowercase or all uppercase.
  graphql-scalars also accepts `-` separators, no separator (`001a2b3c4d5e`),
  `.` groups (`001a.2b3c.4d5e`) and mixed case.
- **`GUID`** is `z.guid()`: 8-4-4-4-12 hex, no braces. graphql-scalars takes
  `{…}` and strips the braces from the value it returns.
- **`ULID`** is kept as sent. graphql-scalars takes either case but returns
  the value upper-cased, so `01arz3…` comes back as `01ARZ3…`; here it comes
  back unchanged. The rule (26 Crockford base32 characters, first 0 to 7) is
  the same.
- **`ObjectID`** is 24 hex digits in either case, as in graphql-scalars, and
  kept as sent in both; the rule is the same. It is a string, not a driver
  `ObjectId`.
- **`ISBN`** takes bare digits only, with its check digit verified (an ISBN-13
  starts 978 or 979-1 to 979-9; an ISBN-10 may end in an uppercase `X`). graphql-scalars
  accepts hyphens, spaces and an `ISBN`/`ISBN-13:` prefix, a lower-case `x`,
  and does not check the digit: `0306406153` and `9780306406158` pass there
  and fail here. Strip the hyphens before you send.
- **`SemVer`** is the same rule: the semver.org regular expression, no `v`
  prefix. Only the message differs (`Invalid semantic version`).
- **`Cuid2`** is the same rule (`^[a-z][a-z0-9]{1,31}$`), so `1abc` is refused
  in both. Only the message differs (`Invalid cuid2`).
- **`JWT`** checks more. graphql-scalars is a regular expression over three
  dot-separated parts, so `a.b.c` and an unsecured
  `eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.` pass there. Here the header and the
  payload must be JSON objects, the signature not empty, and the header `alg`
  not `none`. Neither verifies the signature; do it with
  a JWT library in the resolver, see [Encoding](scalars/encoding.md#jwt).
- **`PhoneNumber`** is strict E.164: `+`, a country code not starting with 0,
  at most 15 digits, no separator. The graphql-scalars regex makes the `+`
  optional, allows spaces, dashes and parentheses, and has no length limit, so
  `0612 34 56 78` passes there and fails here.

### Stricter input

graphql-scalars coerces a string with `parseInt` or `parseFloat`, so `"5"` is
accepted for a number scalar; here a string for a number is refused
(`Invalid input: expected number, received string`). `UUID` there accepts the
brace form and any hex; here it is `z.uuid()`, which checks the version and
the variant.

```ts
import { LongScalar } from '@nxgt/graphql-scalars';

LongScalar.serialize(9223372036854775807n); // '9223372036854775807'
```

## Only here

These have no graphql-scalars counterpart:

- network: `CIDRv4`, `CIDRv6`, `Hostname`;
- identifier: `UUIDv4`, `UUIDv7`, `NanoID`, `KSUID`, `XID`;
- encoding: `Base64`, `Base64URL`, `SHA256`, `SHA512`.

## Aliases we do not repeat

One name per rule, so use the name on the right.

| graphql-scalars | Here |
| --- | --- |
| `UnsignedInt` | `NonNegativeInt` |
| `UnsignedFloat` | `NonNegativeFloat` |
| `ISO8601Duration` | `Duration` (coming) |
| `LocalDate` | `Date` (the `YYYY-MM-DD` string) |

## Not here

`PostalCode`, `USCurrency`, `SESSN`, `AccountNumber`, `RoutingNumber`,
`DeweyDecimal`, `LCCSubclass`, `IPCPatent`, `CountryName`, `Byte` and `Cuid`
(v1; `Cuid2` is a different format) are not planned. Write the one you
need with `zodScalar`:

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const PostalCode = zodScalar(z.string().regex(/^\d{5}$/), {
  name: 'PostalCode',
});
```

`Byte` is a `Buffer` in graphql-scalars; `Base64` is the closest, and
stays a string: decode it in the resolver (see
[Bytes, not strings](scalars/encoding.md#bytes-not-strings)).

See [Custom scalars](custom-scalars.md).
