# Roadmap

Where `@nxgt/graphql-scalars` is going. A direction, not a commitment: the
version an item shipped in is the only number on this page. Items under Next
and Later are candidates, not promises.

## Now

- **First release (0.1.0)** — the seven scalars (`DateTime`, `Date`,
  `EmailAddress`, `URL`, `UUID`, `NonEmptyString`, `PositiveInt`), `zodScalar`
  for your own, `schemas` to reuse the rules outside GraphQL, and
  `scalarTypeDefs` / `scalarResolvers` for schema-first servers.

## Next

- **`JSON` and `JSONObject`** (candidate) — arbitrary JSON values, checked by a
  Zod schema, for the field you cannot type.
- **`valueToLiteral` for graphql 17** (candidate) — if it proves useful, so a
  scalar's default value can be printed in a schema.

## Later

- **`LocalTime` and `Duration`** (candidate) — time of day and ISO 8601
  duration, as strings.
- **`PhoneNumber`** (candidate) — E.164 numbers.
- **`BigInt`** (candidate) — values beyond 32 bits, as a string on the wire.
- **A money scalar** (candidate) — an amount with its currency.

## Not planned

- **A `Date` that decodes to a JavaScript `Date`** — a calendar date is not an
  instant, and the conversion moves a birthday by a day in some time zones.
  Parse the string where the zone is known.
- **`javascript:` and other schemes in `URL`** — the value ends up in an
  `href`, so `URL` stays `http` and `https`. Make a `zodScalar` for another
  rule.
- **A `DateTime` without an offset** — it names no instant.
- **Support for `moduleResolution: "nodenext"`** — the supported setting is
  `bundler`.

## Shipped

Nothing yet: 0.1.0 is the first release.
