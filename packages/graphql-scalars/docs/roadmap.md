# Roadmap

Where `@nxgt/graphql-scalars` is going. A direction, not a commitment: the
version an item shipped in is the only number on this page. Items under Next
and Later are candidates, not promises.

## Now

Next release (a minor):

- **`pickScalars`** — `pickScalars('DateTime', 'URL')` gives the SDL and
  `resolvers` of those scalars only, with the names checked by the compiler.
- **Each scalar's schema on its own** — `dateTimeSchema`, `urlSchema`, … beside
  `schemas`, plus the `ZodScalar<S, N>`, `ScalarName`, `ScalarResolvers` and
  `Schemas` types.
- **Scalars in categories** — date-time, identifier, network, number and
  string, so the package can grow to a hundred scalars and stay readable.
  `scalarTypeDefs` and `scalarResolvers` list the scalars in alphabetical order.

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

- **First release** — the seven scalars (`DateTime`, `Date`, `EmailAddress`,
  `URL`, `UUID`, `NonEmptyString`, `PositiveInt`), `zodScalar` for your own,
  `schemas` to reuse the rules outside GraphQL, and `scalarTypeDefs` /
  `scalarResolvers` for schema-first servers — 0.1.0.
