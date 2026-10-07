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
**Why:** a scalar reads only string, int, float and boolean literals.
**Fix:** pass a scalar literal, or a variable.

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
