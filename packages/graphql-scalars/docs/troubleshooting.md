# Troubleshooting

One entry for each error you can hit, headed by the message you will search
for. `<Name>` is the scalar's GraphQL name and `<issue>` is Zod's first issue.
For the built-in scalars, the scalar's own message never contains the value.

- [Install](#install)
- [Input](#input)
- [Output](#output)
- [Custom scalars](#custom-scalars)
- [pickScalars](#pickscalars)

## Install

### `TS2307: Cannot find module '@nxgt/graphql-scalars'` (or its types)

**When:** type-checking an import of the package.
**Why:** the package is ESM with an `exports` map, which `moduleResolution`
`node`/`node10` ignores, and `nodenext` is not supported.
**Fix:**

```jsonc
{ "compilerOptions": { "moduleResolution": "bundler" } }
```

## Input

### `<Name> cannot represent this input: <issue>`

**When:** a variable or a literal in a query fails the scalar's schema.
**Why:** the value is not what the scalar accepts; `<issue>` says what. For a
bad *variable*, graphql 16 prefixes the message with the value the client sent,
`Variable "$n" got invalid value -3; PositiveInt cannot represent this input: Too small: expected number to be >0`; graphql 17 does not, `Variable "$n" has invalid value: PositiveInt cannot represent this input: Too small: expected number to be >0`.
**Fix:** send a valid value. Common issues:

| Message | Cause |
| --- | --- |
| `DateTime cannot represent this input: Invalid ISO datetime` | no offset (`2024-03-10T12:00:00`), an impossible day, or a date alone; add `Z` or `±hh:mm` |
| `DateTime cannot represent this input: Invalid input: expected string, received number` | an epoch number; send an RFC 3339 string |
| `Date cannot represent this input: Invalid ISO date` | not `YYYY-MM-DD`, or an impossible day such as `2023-02-29`; a date-time is refused |
| `Time cannot represent this input: Invalid time: expected HH:MM:SS with an offset` | no offset (`10:15:30`), no seconds (`10:15Z`), a lower-case `z`, hour 24 or second 60; send `10:15:30Z` or `10:15:30+02:00` |
| `LocalTime cannot represent this input: Invalid ISO time` | `24:00`, a `Z` or an offset (use `Time`), or not `HH:MM` / `HH:MM:SS` |
| `LocalDateTime cannot represent this input: Invalid local date-time: it has no offset, not even Z` | a trailing `Z`; drop it, or use `DateTime` for an instant |
| `LocalDateTime cannot represent this input: Invalid ISO datetime` | an offset (`+02:00`), a date alone, a space instead of `T`, or an impossible day |
| `Duration cannot represent this input: Invalid ISO duration` | weeks mixed with other units (`P1W2D`), a sign (`-P1D`), lower case, or nothing after `P` or `T` |
| `UtcOffset cannot represent this input: Invalid UTC offset: expected ±HH:MM from -12:00 to +14:00` | `Z`, a one-digit hour (`+5:30`), no sign, or outside -12:00 to +14:00 |
| `UtcOffset cannot represent this input: Invalid UTC offset: write no offset as +00:00` | `-00:00`; send `+00:00` |
| `TimeZone cannot represent this input: Invalid time zone: expected an IANA name` | a name the runtime's tz data does not know (a zone newer than it, or a typo), the wrong case (`europe/paris`), or an offset (`+05:30`; use `UtcOffset`) |
| `Timestamp cannot represent this input: Invalid input: expected int, received number` | a fraction such as `1.5` |
| `Timestamp cannot represent this input: Invalid input: expected number, received string` | `"1710065730000"` is a string; send the number |
| `Timestamp cannot represent this input: Expected an integer, not -0` | `-0`; send `0` |
| `Timestamp cannot represent this input: Invalid input: expected number, received boolean` | a boolean, or anything that is not a number |
| `Timestamp cannot represent this input: Too big: expected number to be <=8640000000000000` | past what a `Date` holds; below -8.64e15 it says `Too small: expected number to be >=-8640000000000000` |
| `HexColorCode cannot represent this input: Invalid hex color code` | no `#` (`ff0000`), a length other than 3, 4, 6 or 8 digits, a non-hex digit, or a space; send `#ff0000` |
| `RGB cannot represent this input: Invalid RGB color: expected rgb(R, G, B), each 0 to 255` | a component above 255, a leading zero, a percentage, no space after the commas, the space-separated syntax, an alpha (use `RGBA`), or a fraction; send `rgb(255, 0, 0)` |
| `RGBA cannot represent this input: Invalid RGBA color: expected rgba(R, G, B, A), each 0 to 255, A 0 to 1` | as `RGB`, or an alpha written `.5`, `1.0`, `0.50` or `50%`, above 1, or missing; send `0`, `1` or `0.5` |
| `HSL cannot represent this input: Invalid HSL color: expected hsl(H, S%, L%), H 0 to 359, S and L 0 to 100` | a hue of 360 or more (write `0`), a `deg` unit, a saturation or lightness without `%` or above 100, a fraction, an alpha (use `HSLA`), or commas without spaces |
| `HSLA cannot represent this input: Invalid HSLA color: expected hsla(H, S%, L%, A), H 0 to 359, S and L 0 to 100, A 0 to 1` | as `HSL`, or an alpha written `.5`, `1.0` or `50%`, above 1, or missing |
| `IBAN cannot represent this input: Invalid IBAN` | a wrong check digit, lower case, or the printed form in groups of four (`FR14 2004 …`); strip the spaces and upper-case on the client |
| `IBAN cannot represent this input: Invalid IBAN: unknown country, or not its length` | the check digits hold, but the country is not in the SWIFT IBAN registry or the IBAN is not its length (a German IBAN is 22 characters) |
| `Currency cannot represent this input: Invalid currency: expected an ISO 4217 code in force` | lower case (`eur`), not three letters, an unknown code, or a withdrawn one (`FRF`, `HRK`, `SLL`); send `EUR` |
| `Latitude cannot represent this input: Too big: expected number to be <=90` | past 90 degrees; below -90 it says `Too small: expected number to be >=-90`. A swapped pair (a GeoJSON `[longitude, latitude]` read as latitude first) lands here |
| `Longitude cannot represent this input: Too big: expected number to be <=180` | past 180 degrees; below -180 it says `Too small: expected number to be >=-180` |
| `Latitude cannot represent this input: Invalid input: expected number, received string` | `"48.8566"` or `48°51'N` is a string; send the number in decimal degrees (same for `Longitude`) |
| `CountryCode cannot represent this input: Invalid country code: expected an ISO 3166-1 alpha-2 code` | lower case (`fr`), three letters (`FRA`), an unassigned code, or `UK` (use `GB`), `EU`, `SU`, `XK` |
| `Locale cannot represent this input: Invalid locale: expected a canonical BCP 47 tag` | not canonical: `fr-fr`, `FR`, `en_US`, or `-u-` keys out of order; send what `Intl.getCanonicalLocales` writes (`fr-FR`, `en-US`) |
| `Locale cannot represent this input: Invalid locale: at most 255 characters` | a tag longer than 255 characters |
| `EmailAddress cannot represent this input: Invalid email address` | not an email address |
| `URL cannot represent this input: Invalid URL` | not absolute, or a scheme other than `http` and `https` (`javascript:`, `data:`, `mailto:`) |
| `IPv4 cannot represent this input: Invalid IPv4 address` | not a dotted quad: a part above 255, a leading zero (`01.2.3.4`), fewer than four parts, a `/prefix` (use `CIDRv4`), or an IPv6 |
| `IPv6 cannot represent this input: Invalid IPv6 address` | not an RFC 4291 text form: a zone (`fe80::1%eth0`), `:::`, a non-hex digit, or an IPv4 |
| `IP cannot represent this input: Expected an IPv4 or IPv6 address` | neither an `IPv4` nor an `IPv6` value, such as a host name or `256.0.0.1` |
| `CIDRv4 cannot represent this input: Invalid IPv4 range` | no `/prefix`, a prefix above 32, or an address that is not an IPv4 |
| `CIDRv6 cannot represent this input: Invalid IPv6 range` | no `/prefix`, a prefix above 128, or an address that is not an IPv6 |
| `MAC cannot represent this input: Invalid MAC address` | not six `:`-separated hex pairs, mixed case (`00:1a:2B:3c:4d:5e`), or `-` or `.` separators; use all lowercase or all uppercase with colons |
| `Hostname cannot represent this input: Invalid hostname` | an empty value, a space, an underscore, a label that starts or ends with `-`, or a label of more than 63 characters |
| `PhoneNumber cannot represent this input: Invalid E.164 number` | no leading `+`, a country code starting with 0, spaces or dashes, or more than 15 digits; send `+33612345678` |
| `Base64 cannot represent this input: Invalid base64` | not the canonical spelling: `YR==` decodes to the same byte as `YQ==`; send what an encoder produces |
| `Base64 cannot represent this input: Invalid base64-encoded string` | malformed: padding missing (`aGk`) or too long, a space or newline, or the URL-safe alphabet (`-`, `_`; use `Base64URL`) |
| `Base64URL cannot represent this input: Invalid base64url` | not the canonical spelling: `YR` for `YQ` |
| `Base64URL cannot represent this input: Invalid base64url-encoded string` | malformed: `=` padding, the standard alphabet (`+`, `/`; use `Base64`) or a space |
| `Hexadecimal cannot represent this input: Expected at least one hexadecimal digit` | the empty string |
| `Hexadecimal cannot represent this input: Invalid hex` | a `0x` prefix, a space or a non-hex digit |
| `JWT cannot represent this input: Invalid JWT` | not three unpadded base64url parts; a header or payload that is not a JSON object; an empty signature; or a header `alg` that is missing, not a string, or `none` (an unsecured token): sign it |
| `SHA256 cannot represent this input: Invalid SHA-256 digest: expected 64 hexadecimal digits` | not 64 hexadecimal digits (a SHA-512 is 128) |
| `SHA512 cannot represent this input: Invalid SHA-512 digest: expected 128 hexadecimal digits` | not 128 hexadecimal digits (a SHA-256 is 64) |
| `UUID cannot represent this input: Invalid UUID` | not the 8-4-4-4-12 form |
| `UUIDv4 cannot represent this input: Invalid UUID` | not a version 4 UUID: another version (a `v7`, a `v1`) or a wrong variant; use `UUID` to take any version |
| `UUIDv7 cannot represent this input: Invalid UUID` | not a version 7 UUID: another version or a wrong variant |
| `GUID cannot represent this input: Invalid GUID` | not 8-4-4-4-12 hex digits: braces (`{…}`), no hyphens or a non-hex digit |
| `ULID cannot represent this input: Invalid ULID` | not 26 Crockford base32 characters, a first character above 7, or an `I`, `L`, `O` or `U` |
| `Cuid2 cannot represent this input: Invalid cuid2` | not a lower-case letter then lower-case letters and digits, 2 to 32 in all: starts with a digit (`1abc`), a single character, upper case or a `-` |
| `NanoID cannot represent this input: Invalid nanoid` | not 21 characters of `A-Za-z0-9_-` (a custom size or alphabet needs your own scalar) |
| `KSUID cannot represent this input: Invalid KSUID` | not 27 base62 characters, or past the 160-bit maximum `aWgEPTl1tmebfsQzFP4bxwgy80V` |
| `XID cannot represent this input: Invalid XID` | not 20 lowercase base32hex characters (`0-9`, `a-v`), or a last character other than `0` or `g` |
| `ObjectID cannot represent this input: Invalid ObjectID` | not 24 hex digits: a wrong length, a non-hex digit or a space around it |
| `ISBN cannot represent this input: Invalid ISBN` | a wrong check digit, hyphens or spaces (`978-0-306-40615-7`), a lower-case `x`, an ISBN-13 not starting 978 or 979-1 to 979-9 (`979-0` is the ISMN), or a wrong length; send the bare digits |
| `SemVer cannot represent this input: Invalid semantic version` | a `v` prefix, fewer than three parts, a leading zero (`01.2.3`) or an empty pre-release or build |
| `NonEmptyString cannot represent this input: Must not be empty or blank` | empty or only white space |
| `Emoji cannot represent this input: Invalid emoji` | not an emoji: text, an empty string, a lone joiner (U+200D), variation selector, skin tone or keycap mark |
| `Emoji cannot represent this input: Invalid emoji: too long` | more than 32 code points; the longest emoji is 10 |
| `Emoji cannot represent this input` (nothing after it) | the runtime has no `Intl.Segmenter` (Firefox before 125, Safari before 14.1, Node without ICU); the original error is the `GraphQLError`'s `originalError` |
| `Emoji cannot represent this input: Invalid emoji: expected exactly one` | more than one emoji (`😀😀`, two flags), or a sequence newer than the runtime's Unicode data, which it counts as two |
| `PositiveInt cannot represent this input: Too small: expected number to be >0` | `0` or negative |
| `PositiveInt cannot represent this input: Too big: expected number to be <=2147483647` | above 32 bits |
| `PositiveInt cannot represent this input: Invalid input: expected int, received number` | not an integer, such as `1.5` |
| `PositiveInt cannot represent this input: Invalid input: expected number, received string` | `"1"` is a string; send `1` |
| `Port cannot represent this input: Too big: expected number to be <=65535` | above 65535 |
| `Port cannot represent this input: Too small: expected number to be >=0` | negative, such as `-1` |
| `Port cannot represent this input: Invalid input: expected int, received number` | not an integer, such as `80.5` |
| `<Name> cannot represent this input: Expected an integer, not -0` | `-0` for an integer scalar (`NonNegativeInt`, `SafeInt`, `Port`, `Long`, …): send `0` |
| `SafeInt cannot represent this input: Too big: expected int to be <=9007199254740991` | past 2^53; use `Long` or `BigInt` |
| `Long cannot represent this input: Expected a decimal integer, with no leading zero and no "-0"` | a string such as `"007"`, `"-0"`, `"+1"` or `" 1"` |

### `Long cannot represent this input: Too big: expected int to be <=9007199254740991`

**When:** a query writes a number literal past 2^53 for a `Long` or `BigInt`
argument (`echo(v: 9223372036854775807)`, with `echo(v: Long): Long`).
**Why:** a literal that large is read as a float by the parser and would lose
precision, so it is refused rather than rounded. A `Long` out of range written
as a string says `Too big: expected bigint to be <=9223372036854775807`
instead.
**Fix:** write the value as a string literal, or pass it as a string variable.

```graphql
query {
  echo(v: "9223372036854775807")
}
```

### `Long cannot represent this input: Expected a decimal integer string or a safe integer`

**When:** a variable or literal for a `Long` or `BigInt` is neither a string
nor an integer number: a JSON variable `1.5`, `true`, an object. (A float
*literal* such as `1.5` in the query is refused earlier, with `cannot
represent a FloatValue literal`.)
**Why:** the way in takes a canonical decimal string or a safe integer. A string
such as `"007"` says `Expected a decimal integer, with no leading zero and no "-0"`
instead.
**Fix:** send a decimal string, or an integer number within 2^53.

### `JSON cannot represent this input: Expected a JSON value`

**When:** a variable or literal for a `JSON` field is something JSON cannot
write back as it is: a cycle, `undefined` (also as an object's field or an
array's hole), a `Date`, a `Map`, a class instance, `NaN`, `Infinity`, a
`bigint`, or nesting past 1000 levels. The same message with `cannot
serialize this value` is a resolver's result that is one of those.
**Why:** `JSON` keeps the value as it is, so it refuses what would change on
the way (a `Date` becomes a string, `undefined` vanishes, `NaN` becomes
`null`).
**Fix:** convert before sending or returning: `date.toISOString()`,
`Object.fromEntries(map)`, `String(bigint)`, `null` instead of `undefined`.
See [Value scalars](guide/scalars/value.md).

### `JSONObject cannot represent this input: Expected a JSON object`

**When:** the value is not a plain object whose fields are all JSON values:
an array, `null`, a string, a number, a `Date`, or anything `JSON` refuses.
**Why:** `JSONObject` takes an object only.
**Fix:** send an object (`{ "items": [1, 2] }` for a list), or use `JSON` for
a value of any kind.

### `Void cannot represent this input: Expected no value`

**When:** a variable or literal for a `Void` field is anything but `null`; or,
with `cannot serialize this value`, a resolver returns a value for a `Void`
field (`resolve: () => 'ok'`).
**Why:** `Void` is `null` only. A resolver that returns nothing answers
`null` by itself, but one that returns a value is refused, so the value is
not dropped silently.
**Fix:** return nothing from the resolver, or give the field a type that
holds the value.

### `<Name> cannot represent a FloatValue literal`

**When:** a query writes a float literal for an integer scalar, even one that
holds an integer: `items(first: 1.0)`, `views(id: 1e3)`.
**Why:** the integer scalars read literals as GraphQL's `Int` does (a scalar
of your own does with `literals: 'integer'`).
**Fix:** write the integer: `items(first: 1)`. Large `Long` and `BigInt`
values go as a string: `views(id: "1000")`.

### `<Name> cannot represent a ListValue literal`

**When:** a query writes a list, an object or an enum value where the scalar
reads a literal, for example `later(at: [1])`. The kind is named in the
message: `ListValue`, `ObjectValue`, `EnumValue`.
**Why:** a scalar reads only string, int, float and boolean literals. `JSON`
and `JSONObject` read every kind; a scalar of your own does with
`literals: 'any'`.
**Fix:** pass a scalar literal, or a variable; for an object, make the scalar
with `literals: 'any'` (see [Custom scalars](guide/custom-scalars.md#literals)).

```graphql
query ($at: DateTime) {
  later(at: $at)
}
```

## Output

### `<Name> cannot serialize this value: <issue>`

**When:** a resolver returns a value the scalar refuses. It is a field error:
the field is `null` (or its nearest nullable parent) and the message does not
name the value.
**Why:** a result is checked as strictly as an input.
**Fix:** return what the scalar's wire schema accepts after encoding; see the
entries below.

### `DateTime cannot serialize this value: Invalid input: expected date, received string`

**When:** a resolver returns an ISO string for a `DateTime` field, such as one
read straight from a database or an HTTP body.
**Why:** `DateTime` serializes a `Date` only.
**Fix:**

```ts
resolve: (row) => new Date(row.createdAt), // not row.createdAt
```

### `DateTime cannot serialize this value: Invalid Date`

**When:** a resolver returns an invalid `Date`, such as `new Date('nonsense')`.
**Why:** `new Date(Number.NaN)` is a `Date` with no time, so it names no
instant to write.
**Fix:** validate the source before building the `Date`.

### `Timestamp cannot serialize this value: Invalid Date`

**When:** a resolver returns an invalid `Date` for a `Timestamp` field, such as
`new Date('nonsense')`.
**Why:** an invalid `Date` has no milliseconds to write (`getTime()` is `NaN`).
Returning a number or a string instead says `Invalid input: expected date,
received number` (or `string`): `Timestamp` serializes a `Date` only.
**Fix:** validate the source, and wrap a number: `new Date(row.createdAtMs)`.

### `Long cannot serialize this value: Invalid input: expected bigint, received number`

**When:** a resolver returns a `number` for a `Long` or `BigInt` field, such as
a count read from a database driver. `BigInt` says the same with its own name.
**Why:** both are a `bigint` in resolvers; a `number` past 2^53 may already have
lost digits, so it is not guessed at.
**Fix:**

```ts
resolve: (row) => BigInt(row.count), // not row.count
```

### `URL cannot serialize this value: Invalid URL`

**When:** a resolver returns a non-`http(s)` URL or a relative path.
**Why:** `URL` is absolute and `http`/`https` only, on the way out as well.
**Fix:** return an absolute URL, or use another type for the field.

## Schema

### `Cannot convert value to AST: { a: 1 }.`

**When:** on graphql 16, `printSchema` or an introspection query, for a
schema where a `JSON` or `JSONObject` argument (or one of your own made with
`literals: 'any'`) has an object or list default, such as
`echo(v: JSON = { a: 1 }): JSON`. The introspection query fails with
`Unexpected invariant triggered.`.
**Why:** graphql 16 writes a default back as a literal with `astFromValue`,
which knows no object value for a scalar and has no hook a scalar can fill.
**Fix:** drop the default and apply it in the resolver
(`args.v ?? { a: 1 }`), or move to graphql 17 with an SDL default or a
code-first `default: { value: { a: 1 } }`.

### `Argument "v" has invalid value {at: $d}.`

**When:** on graphql 16, a variable of another custom scalar sits inside a
`JSON` literal, such as `echo(v: { at: $d })` with `$d: DateTime`.
**Why:** graphql 16 hands the literal its variables already parsed, so `$d`
is a `Date`, which is not a JSON value. graphql 17 hands over the wire string.
**Fix:** send the whole value as one `JSON` variable (`echo(v: $v)`), or
type `$d` as `String` or `JSON`.

## Custom scalars

### `<Name> cannot serialize this value: its schema transforms with no way back, use z.codec`

**When:** a result is serialized by a scalar made with `zodScalar` from a
schema that uses `.transform()`. Decoding the same scalar works.
**Why:** a transform has no inverse, so Zod cannot encode through it. Zod's
own error (`Encountered unidirectional transform during encode`) is kept as
the `GraphQLError`'s `originalError`.
**Fix:** write the schema as a `z.codec` with both directions.

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const Len = zodScalar(
  z.codec(z.string(), z.number(), {
    decode: (s) => s.length,
    encode: (n) => 'x'.repeat(n),
  }),
  { name: 'Len' },
);
```

See [Custom scalars](guide/custom-scalars.md#codecs-when-the-value-changes).

## pickScalars

### `TypeError: pickScalars: no scalar is named "<name>". The names are <list>.`

**When:** calling `pickScalars` with a name the package does not have, for
example `pickScalars('Datetime' as never)` or a name read from configuration.
The message lists every valid name.
**Why:** names are case-sensitive GraphQL names, not export names
(`DateTime`, not `DateTimeScalar`).
**Fix:** use a name from the list in the message.

```ts
import { pickScalars } from '@nxgt/graphql-scalars';

pickScalars('DateTime'); // not 'Datetime', not 'DateTimeScalar'
```

### `TS2345: Argument of type '"Datetime"' is not assignable to parameter of type 'ScalarName'`

**When:** type-checking `pickScalars('Datetime')`.
**Why:** the names are typed (`ScalarName`), so a misspelling is caught
before it runs.
**Fix:** spell the name as the GraphQL scalar, or type a name that comes from
elsewhere:

```ts
import { pickScalars, type ScalarName } from '@nxgt/graphql-scalars';

const wanted: ScalarName[] = ['DateTime', 'URL'];
pickScalars(...wanted);
```
