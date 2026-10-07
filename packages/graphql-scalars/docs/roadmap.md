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
- **Extended scalars, category by category** — the number and network
  categories are in the next release: number adds `NegativeInt`,
  `NonNegativeInt`, `NonPositiveInt`, `PositiveFloat`, `NegativeFloat`,
  `NonNegativeFloat`, `NonPositiveFloat`, `SafeInt`, `Port`, `Long` and
  `BigInt`; network adds `IPv4`, `IPv6`, `IP`, `CIDRv4`, `CIDRv6`, `MAC`,
  `Hostname` and `PhoneNumber`. Coming: identifier, encoding,
  date-time, locale, geo, finance, color, value (including `JSON`,
  `JSONObject` and `Void`) and string (`Emoji`). The list grows as categories
  land. See [Migrating from graphql-scalars](guide/migrating-from-graphql-scalars.md).

## Next

- **`JSON` and `JSONObject`** (candidate) — arbitrary JSON values, checked by a
  Zod schema, for the field you cannot type.
- **`valueToLiteral` for graphql 17** (candidate) — if it proves useful, so a
  scalar's default value can be printed in a schema.

## Later

- **A money scalar** (candidate) — an amount with its currency.
- **Load only the scalars you import** (candidate) — importing any scalar
  loads them all, because Bun emits the scalars namespace as one object. It was
  measured at about 160 bytes minified (about 65 gzip) per scalar and about 1 ms
  to load seven. Per-category entry points stay a candidate if a consumer needs
  them.

## Not planned

- **A `Date` that decodes to a JavaScript `Date`** — a calendar date is not an
  instant, and the conversion moves a birthday by a day in some time zones.
  Parse the string where the zone is known.
- **`javascript:` and other schemes in `URL`** — the value ends up in an
  `href`, so `URL` stays `http` and `https`. Make a `zodScalar` for another
  rule.
- **A `DateTime` without an offset** — it names no instant.
- **`CreditCard`** — a server that receives raw card numbers falls under
  PCI DSS. Use the payment provider's token.
- **One-country or loose rules** (postal codes, US account and routing numbers,
  Swedish personnummer, library classifications) — write them with `zodScalar`;
  see [Custom scalars](guide/custom-scalars.md).
- **Aliases** (`UnsignedInt`, `LocalDate`, …) — one name per rule.
- **Support for `moduleResolution: "nodenext"`** — the supported setting is
  `bundler`.

## Shipped

- **First release** — the seven scalars (`DateTime`, `Date`, `EmailAddress`,
  `URL`, `UUID`, `NonEmptyString`, `PositiveInt`), `zodScalar` for your own,
  `schemas` to reuse the rules outside GraphQL, and `scalarTypeDefs` /
  `scalarResolvers` for schema-first servers — 0.1.0.
