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
- **Scalars in categories** — date-time, encoding, identifier, network, number
  and string, so the package can grow to a hundred scalars and stay readable.
  `scalarTypeDefs` and `scalarResolvers` list the scalars in alphabetical order.
- **Extended scalars, category by category** — each category's page in
  [the scalars guide](guide/scalars.md) lists what it adds. In the next
  release:
  - color: `HexColorCode`, `RGB`, `RGBA`, `HSL`, `HSLA`;
  - finance: `IBAN`, `Currency`;
  - geo: `Latitude`, `Longitude`;
  - locale: `CountryCode`, `Locale`;
  - number: the signed Int and Float variants, `SafeInt`, `Port`, `Long`,
    `BigInt`;
  - network: `IPv4`, `IPv6`, `IP`, `CIDRv4`, `CIDRv6`, `MAC`, `Hostname`,
    `PhoneNumber`;
  - identifier: `GUID`, `UUIDv4`, `UUIDv7`, `ULID`, `Cuid2`, `NanoID`,
    `KSUID`, `XID`, `ObjectID`, `ISBN`, `SemVer`;
  - encoding: `Base64`, `Base64URL`, `Hexadecimal`, `JWT`, `SHA256`,
    `SHA512`;
  - value: `JSON`, `JSONObject`, `Void`, and `literals: 'any'` in
    `zodScalar` for a scalar of your own that holds JSON;
  - date-time: `Time`, `LocalTime`, `LocalDateTime`, `Duration`, `UtcOffset`,
    `TimeZone`, `Timestamp`.

  Coming: string (`Emoji`). See
  [Migrating from graphql-scalars](guide/migrating-from-graphql-scalars.md).

## Next

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
