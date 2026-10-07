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
(v1) are not planned; `Cuid2` is a separate scalar, coming. Write the one you
need with `zodScalar`:

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const PostalCode = zodScalar(z.string().regex(/^\d{5}$/), {
  name: 'PostalCode',
});
```

See [Custom scalars](custom-scalars.md).
