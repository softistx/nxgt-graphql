# Roadmap

Where `@nxgt/graphql-scalars` is going. A direction, not a commitment: the
version an item shipped in is the only number on this page. Items under Next
and Later are candidates, not promises.

## Now

Nothing in progress.

## Next

- **`valueToLiteral` for graphql 17** (candidate) — if it proves useful, so a
  scalar's default value can be printed in a schema.

## Later

- **A money scalar** (candidate) — an amount with its currency.
- **Load only the scalars you import** (candidate) — importing any scalar
  loads them all, because Bun emits the scalars namespace as one object. It was
  measured, with seven scalars, at about 160 bytes minified (about 65 gzip) per
  scalar and about 1 ms to load them all; with 65 it is to measure again.
  Per-category entry points stay a candidate if a consumer needs them.

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
  Swedish personnummer, library classifications and patent classes such as
  `IPCPatent`) — write them with `zodScalar`; see
  [Custom scalars](guide/custom-scalars.md).
- **`DID`, `GeoJSON` (and its geometries), `CountryName`, `Byte`, `Cuid` v1** —
  out of scope; write them with `zodScalar`.
- **Aliases** (`UnsignedInt`, `LocalDate`, …) — one name per rule.

## Shipped

Release 0.4.1:

- **Declarations resolve under `nodenext`** — `moduleResolution` `nodenext` and
  `node16` find every export, as `bundler` does.

Release 0.4.0:

- **`scalarSchemas`** — the schema behind each scalar, keyed by its GraphQL
  name and typed exactly, for code generated from a GraphQL schema
  (`@nxgt/graphql-codegen-zod`); each scalar carries its own as `.schema`.
  See [the guide](guide/scalars.md#keyed-by-graphql-name).

Release 0.3.0:

- **The SDL as a file** — `graphql/scalars.graphqls` in the package, and the
  `nxgt-graphql-scalars typedefs [<Name>...] [--out [<file>]]` bin, for an IDE
  or a server that scans `.graphql(s)` files; see
  [the guide](guide/scalars.md#the-sdl-as-a-file).

Release 0.2.0:

- **65 scalars in 11 categories** — the 7 of 0.1.0 plus 58 more, so the package
  can grow to a hundred and stay readable. Each category's page in
  [the scalars guide](guide/scalars.md) lists its scalars:
  - color: `HexColorCode`, `RGB`, `RGBA`, `HSL`, `HSLA`;
  - date-time: `DateTime`, `Date`, `Time`, `LocalTime`, `LocalDateTime`,
    `Duration`, `UtcOffset`, `TimeZone`, `Timestamp`;
  - encoding: `Base64`, `Base64URL`, `Hexadecimal`, `JWT`, `SHA256`,
    `SHA512`;
  - finance: `IBAN`, `Currency`;
  - geo: `Latitude`, `Longitude`;
  - identifier: `UUID`, `UUIDv4`, `UUIDv7`, `GUID`, `ULID`, `Cuid2`, `NanoID`,
    `KSUID`, `XID`, `ObjectID`, `ISBN`, `SemVer`;
  - locale: `CountryCode`, `Locale`;
  - network: `URL`, `EmailAddress`, `IPv4`, `IPv6`, `IP`, `CIDRv4`, `CIDRv6`,
    `MAC`, `Hostname`, `PhoneNumber`;
  - number: `PositiveInt`, the other signed Int and Float variants, `SafeInt`,
    `Port`, `Long`, `BigInt`, and `literals: 'integer'` in `zodScalar` for an
    integer scalar of your own;
  - string: `NonEmptyString`, `Emoji`;
  - value: `JSON`, `JSONObject`, `Void`, and `literals: 'any'` in `zodScalar`
    for a scalar of your own that holds JSON.
- **`pickScalars`** — `pickScalars('DateTime', 'URL')` gives the SDL and
  `resolvers` of those scalars only, with the names checked by the compiler.
- **Each scalar's schema on its own** — `dateTimeSchema`, `urlSchema`, … beside
  `schemas`, plus the `ZodScalar<S, N>`, `ScalarName`, `ScalarResolvers` and
  `Schemas` types. `scalarTypeDefs`, `scalarResolvers` and `schemas` list the
  scalars in the code-unit order of their export names (`HSLA` before `HSL`;
  `schemas` follows the `…Schema` names, `hsl` before `hsla`).
- **An audit of every scalar** — no input is rewritten on its way in, and Node,
  Bun and browsers give the same answer. It changes six scalars of 0.1.0
  (`URL`, `DateTime`, `EmailAddress`, `UUID`, `NonEmptyString`, `PositiveInt`) and the
  message of every refusal, now `Invalid <format>[: hint]`; see
  [Migrating from graphql-scalars](guide/migrating-from-graphql-scalars.md) and
  [Troubleshooting](troubleshooting.md).

Release 0.1.0:

- **First release** — the seven scalars (`DateTime`, `Date`, `EmailAddress`,
  `URL`, `UUID`, `NonEmptyString`, `PositiveInt`), `zodScalar` for your own,
  `schemas` to reuse the rules outside GraphQL, and `scalarTypeDefs` /
  `scalarResolvers` for schema-first servers — 0.1.0.
