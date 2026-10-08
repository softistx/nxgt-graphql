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
| `Hexadecimal` | one or more hex digits, any case, kept as sent, no `0x`; only the messages differ (`Invalid hexadecimal: expected at least one digit` or `Invalid hex` here, `Value is not a valid hexadecimal value: …` there) |
| `NonEmptyString` | a string with at least one non-white-space character, kept as sent; only the message differs (`Invalid string: empty or only white space`) |
| `PositiveFloat` | a finite number above 0; a string is refused here, accepted there |
| `NegativeFloat` | a finite number below 0; a string is refused here, accepted there |
| `NonNegativeFloat` | a finite number, 0 or above; a string is refused here, accepted there |
| `NonPositiveFloat` | a finite number, 0 or below; a string is refused here, accepted there |
| `SafeInt` | ±(2^53 - 1); a string is refused in both |

## Same name, different rule

- **`Date`** is a string `YYYY-MM-DD` on both sides. In graphql-scalars 2.0.0
  `Date` is a JavaScript `Date` object, and its `YYYY-MM-DD` string scalar is
  `LocalDate`.
- **`PositiveInt`, `NegativeInt`, `NonNegativeInt` and `NonPositiveInt`** are
  32 bits here (1 to 2147483647, -2147483648 to -1, 0 to 2147483647,
  -2147483648 to 0), numbers only. graphql-scalars 2.0.0 has no 32-bit bound
  (`PositiveInt` takes 2147483648) and coerces a string: `"1e3"` is 1, `"1.5"`
  is 1.
- **`Port`** is 0 to 65535 here, an integer number only. graphql-scalars
  describes 0 to 65535 but refuses `0`, and also takes `"80"` and `80.5`; this
  one accepts `0`.
- **`DateTime`** (a `Date` in resolvers, as in graphql-scalars) requires an
  offset (`Z` or `±hh:mm`) and resolves to a `Date`, serialized in UTC. A time
  with no offset is refused, and so are the offset `-00:00` and an instant
  outside year 0000 to 9999 in UTC. A fraction past milliseconds is cut to three
  digits.
- **`URL`** is `http` and `https` only and stays a string as sent; there is no
  `URL` object in resolvers, and nothing is rewritten. graphql-scalars gives a
  resolver a `URL` object (`new URL(value)`) and serializes `url.toString()`,
  which takes `javascript:` and lower-cases the host, so `HTTPS://EXAMPLE.COM`
  comes back as `https://example.com/`; here the resolver gets the string as
  sent. The
  scheme must be lowercase, the host a host name, a canonical IPv4 or a
  bracketed IPv6, with no user info, a port with no leading zero, and no white
  space, control or invisible character (send a Unicode host in its punycode
  form). An uppercase host, `:443`, dot segments and percent-escapes are kept as
  sent.
- **`EmailAddress`** is narrower on both sides of the `@`. The local part is
  `z.email()`'s: letters, digits, `_`, `'`, `+`, `-` and dots between them.
  graphql-scalars also takes `!#$%&*/=?^` and a few more characters. The domain
  follows `Hostname`'s rule with at least two labels and a last label of letters
  or `xn--`: `ada@localhost` and `ada@x.c0m` pass there and fail here.
- **`UUID`** is an RFC 9562 UUID: a version 1 to 8 with the RFC variant, or the
  nil or max UUID, in any case. graphql-scalars takes any 8-4-4-4-12 hex, with
  or without braces; here that is `GUID` (without braces).
- **The number scalars** take a number only. graphql-scalars coerces a string
  with `parseInt` or `parseFloat` (except `SafeInt`, which refuses it too), so
  `"5"` is accepted there; here a string for a number is refused
  (`Invalid input: expected number, received string`).
- **`Long` and `BigInt`** are a `bigint` in resolvers and always a decimal
  string on the wire. A resolver returning a `number` is refused. Input accepts
  a canonical decimal string or a safe-integer number; a literal past 2^53
  written as a number is refused, so write it as a string. graphql-scalars
  serializes a safe value as a JSON number; here the result is always a string,
  so a client that reads numbers must parse it (`BigInt(data.views)`).
- **`IPv4`** refuses a leading zero (`01.2.3.4`) and a `/prefix`;
  graphql-scalars accepts both (its regex allows `0?0?` before each part and an
  optional `/0` to `/32`). Use `CIDRv4` for a block.
- **`IPv6`** refuses a `/prefix`, which graphql-scalars accepts; use `CIDRv6`.
  Both refuse a zone. Neither normalises the value.
- **`IP`** follows its two parts, so it refuses an address with a prefix and an
  IPv4 with a leading zero.
- **`MAC`** is six hex pairs separated by `:`, in any case, kept as sent.
  graphql-scalars also accepts `-` separators, no separator (`001a2b3c4d5e`) and
  `.` groups (`001a.2b3c.4d5e`).
- **`GUID`** is `z.guid()`: 8-4-4-4-12 hex, no braces. graphql-scalars takes
  `{…}` and strips the braces from the value it returns.
- **`ULID`** is kept as sent. graphql-scalars takes either case but returns the
  value upper-cased, so `01arz3…` comes back as `01ARZ3…`; here it comes back
  unchanged. The rule (26 Crockford base32 characters, first 0 to 7) is the
  same.
- **`ObjectID`** is 24 hex digits in any case, as in graphql-scalars, and kept
  as sent in both; the rule is the same. It is a string, not a driver
  `ObjectId`.
- **`ISBN`** takes bare digits only, with its check digit verified (an ISBN-13
  starts 978 or 979-1 to 979-9; an ISBN-10 may end in an uppercase `X`).
  graphql-scalars accepts hyphens, spaces and an `ISBN`/`ISBN-13:` prefix, a
  lower-case `x`, and does not check the digit: `0306406153` and `9780306406158`
  pass there and fail here. Strip the hyphens before you send.
- **`SemVer`** is the same rule: the semver.org regular expression, no `v`
  prefix. Only the message differs (`Invalid semantic version`).
- **`Cuid2`** is the same rule (`^[a-z][a-z0-9]{1,31}$`), so `1abc` is refused
  in both. Only the message differs (`Invalid cuid2`).
- **`JWT`** checks more. graphql-scalars is a regular expression over three
  dot-separated parts, so `a.b.c` and an unsecured
  `eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.` pass there. Here the header and the
  payload must be JSON objects, the signature not empty, and the header `alg`
  not empty and not `none`, each part in its one base64url spelling. Neither
  verifies the signature; do it with a JWT library in the resolver, see
  [Encoding](scalars/encoding.md#jwt).
- **`PhoneNumber`** is strict E.164: `+`, a country code not starting with 0, at
  most 15 digits, no separator. The graphql-scalars regex makes the `+`
  optional, allows spaces, dashes and parentheses, and has no length limit, so
  `0612 34 56 78` passes there and fails here.
- **`CountryCode`** is uppercase only, and only the 249 officially assigned ISO
  3166-1 alpha-2 codes. graphql-scalars accepts `fr` and `Fr`, and `XK`
  (user-assigned); here they are refused. Both refuse `UK`, `EU` and `ZZ`. The
  messages differ (`Value is not a valid country code: UK` there).
- **`Locale`** is canonical case only, and the same on every runtime (an alias
  such as `tl` is taken). graphql-scalars accepts `fr-fr`, `FR`, `zh-hant-tw`,
  `x-foo` and `i-klingon`; here they are refused, not rewritten. Both refuse
  `en_US` and `en-`. Canonicalise on the client with `Intl.getCanonicalLocales`
  (see [Locale](scalars/locale.md)).
- **`IBAN`** is the electronic form only. graphql-scalars 2.0.0 checks the
  country, length and check digits too, but accepts the printed form with spaces
  (`FR14 2004 1010 …`) and lower case (`fr14…`) and returns it as sent; here
  both are refused, not rewritten. Strip the spaces and upper-case on the
  client. The messages differ (`Value is not a valid IBAN: …` there, `Invalid
  IBAN` here).
- **`Currency`** is uppercase only and a list of codes in force. graphql-scalars
  accepts `eur` and returns it as sent, and keeps `HRK` and `SLL` while it
  refuses `FRF`; here all three are refused, as withdrawn. Both accept `XAU`,
  `XXX` and `XTS`. The messages differ (`Value is not a valid currency value: …`
  there, `Invalid currency: expected an ISO 4217 code in force` here). The list
  is Zod's, so a newer Zod 4 may know newer codes.
- **`Latitude`** and **`Longitude`** are numbers only. graphql-scalars accepts a
  string as well (`"48.8566"`, `"12"`) and reads degrees-minutes-seconds
  (`48°51'N` becomes `48.85`, rounded to two decimals); here every string is
  refused, so convert on the client. There an `Int` literal is refused (`Can
  only validate floats or strings as latitude but got a: IntValue`); here `45`
  is accepted. Both refuse `NaN`, `null` and a value out of range; the messages
  differ (`Value must be between -90 and 90: 91` there, `Too big: expected
  number to be <=90` here).
- **`HexColorCode`** takes 3, 4, 6 and 8 digits, any case (mixed included), kept
  as sent. graphql-scalars takes 3, 6 and 8 (`#ff000080`) but refuses the
  4-digit form (`#f008`). Both require the `#`.
- **`RGB`** and **`RGBA`** are one canonical spelling. graphql-scalars checks
  the shape and not the range, and keeps what it is given: `rgb(256, 0, 0)`,
  `rgb(01, 0, 0)`, `rgb(100%, 0%, 0%)`, `rgb(255,0,0)`, `rgb( 255 , 0 , 0 )` and
  `rgba(255, 0, 0, 2)` all pass there. It also takes `.5`, `1.0` and `0.50` as
  an alpha. Here components are integers from 0 to 255, the separator is `", "`,
  and the alpha is `0`, `1` or `0.x` with no trailing zero; every one of those
  is refused. Both refuse the space-separated syntax, `50%` as an alpha and a
  missing alpha for `RGBA`.
- **`HSL`** and **`HSLA`** are the same story: graphql-scalars takes `hsl(360,
  100%, 50%)`, `hsl(361, …)`, `hsl(-1, 0%, 0%)`, `hsl(120, 101%, 50%)`,
  `hsl(120.5, 100.5%, 50%)`, `hsl(120,100%,50%)` and an alpha of `2`; here the
  hue is 0 to 359 (360 is `0`), saturation and lightness are integers from 0% to
  100%, and the alpha is as for `RGBA`. Both refuse `120deg`, a percentage
  without `%` and `50%` as an alpha. The messages differ (`Value is not a valid
  HSL color: …` there).
- **`Time`** is a string `10:15:30Z` on both sides and keeps the offset as sent.
  graphql-scalars resolves it to a `Date` (today's date at that time, moved to
  UTC: `10:15:30+02:00` is 08:15:30 UTC) and serializes a `Date` back to
  `HH:MM:SS.sssZ`. Both refuse a time with no offset and `24:00:00Z`.
- **`LocalTime`** takes `HH:MM`, `HH:MM:SS` and a fraction (`10:15:30.5`), which
  graphql-scalars refuses. Both refuse `24:00`; there, `LocalEndTime` takes it,
  and here nothing does (`23:59:59` or `00:00` the next day).
- **`LocalDateTime`** requires `T`, accepts `HH:MM` as well as `HH:MM:SS`, and
  refuses a `Z` or an offset. graphql-scalars requires seconds and accepts
  `2024-03-10T10:15:30Z` and `…+02:00`, which are not local.
- **`Duration`** is stricter than graphql-scalars `Duration` (and its alias
  `ISO8601Duration`): no sign (`-P1D`), no fractional day or hour (`P1.5D`), and
  weeks are not mixed with other units (`P1W2D`). Both refuse `P`, `PT` and
  lower case.
- **`Timestamp`** is an integer on the wire and a `Date` in resolvers, as there,
  but refuses what graphql-scalars lets through: a string
  (`"2024-03-10T10:15:30Z"` is read as a date there), a fraction (`1.5` becomes
  a `Date` there), `-0`, a boolean, and a value past ±8.64e15 (an invalid `Date`
  there, which fails only later, when something formats it). An invalid `Date`
  is an error here; there it comes out as `NaN`, which JSON writes as `null`.
- **`UtcOffset`** is `±hh:mm` from `-12:00` to `+14:00`, written `+00:00` for
  none. graphql-scalars takes `-00:00`, `+14:30`, `-12:30`, `+15:00` and `05:30`
  (no sign); `Z` is refused in both.
- **`TimeZone`** is an IANA name the runtime's `Intl` knows, in the right case,
  and refuses an offset. graphql-scalars 2.0.0 has no list: it asks
  `Intl.DateTimeFormat`, which ignores case and takes offsets, so `europe/paris`
  and `+05:30` are accepted there and returned as sent. Both keep an alias
  (`Asia/Calcutta`, `US/Pacific`) and both depend on the runtime's tz data.
- **`JSON`**, **`JSONObject`** and **`Void`** keep their names and are stricter.
  graphql-scalars 2.0.0 passes through what JSON cannot hold: a `Date` goes in
  and out as a `Date` (JSON writes it as a string), a field set to `undefined`
  stays, `NaN` goes through `JSON` (and is written as `null`, as `-0` is written
  `0`), and an enum value in a literal reads as `undefined`. A cycle throws the
  engine's `Converting circular structure to JSON`, and a `bigint` throws `Do
  not know how to serialize a BigInt`. Here every one of them is refused with
  `Invalid JSON value`, both ways, and an enum value in a literal is its name
  (`'RED'`). `JSONObject` there refuses `null`, a number and an array
  (`JSONObject cannot represent non-object value: …`) but accepts a `Date`; here
  it also refuses a `Date`, and the message is `Invalid JSON object`. `Void`
  there serializes any result as `""` and reads any input as `null`; here a
  resolver returning a value, and any input but `null`, is refused (`Invalid
  void: expected null`). A resolver returning nothing answers `null` in both.

A `Long` always leaves as a string, where graphql-scalars writes a number:

```ts
import { LongScalar } from '@nxgt/graphql-scalars';

LongScalar.serialize(9223372036854775807n); // '9223372036854775807'
```

## Only here

These have no graphql-scalars counterpart:

- network: `CIDRv4`, `CIDRv6`, `Hostname`;
- identifier: `UUIDv4`, `UUIDv7`, `NanoID`, `KSUID`, `XID`;
- encoding: `Base64`, `Base64URL`, `SHA256`, `SHA512`;
- string: `Emoji`.

## Aliases we do not repeat

One name per rule, so use the name on the right.

| graphql-scalars | Here |
| --- | --- |
| `UnsignedInt` | `NonNegativeInt` |
| `UnsignedFloat` | `NonNegativeFloat` |
| `ISO8601Duration` | `Duration` |
| `LocalDate` | `Date` (the `YYYY-MM-DD` string) |
| `DateTimeISO` | `DateTime` (an offset is required; it is a `Date` in resolvers) |
| `LocalEndTime` | none: `24:00` is refused, use `LocalTime` with `23:59:59` or `00:00` |

## Not here

`USCurrency` (a money amount: a candidate, see the
[Roadmap](../roadmap.md) and [With an amount](scalars/finance.md#with-an-amount)),
`PostalCode`, `SESSN`, `AccountNumber`,
`RoutingNumber`, `DeweyDecimal`, `LCCSubclass`, `IPCPatent`, `CountryName`,
`DID`, `GeoJSON` and its geometry types, `Byte` and `Cuid` (v1; `Cuid2` is a
different format) are not planned. Write the one you
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
