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
| `UUID cannot represent this input: Invalid UUID` | not the 8-4-4-4-12 form |
| `NonEmptyString cannot represent this input: Must not be empty or blank` | empty or only white space |
| `PositiveInt cannot represent this input: Too small: expected number to be >0` | `0` or negative |
| `PositiveInt cannot represent this input: Too big: expected number to be <=2147483647` | above 32 bits |
| `PositiveInt cannot represent this input: Invalid input: expected int, received number` | not an integer, such as `1.5` |
| `PositiveInt cannot represent this input: Invalid input: expected number, received string` | `"1"` is a string; send `1` |

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
