# @nxgt/graphql-scalars

## 0.3.0

### Minor Changes

- [#25](https://github.com/softistx/nxgt-graphql/pull/25) [`a7c9b15`](https://github.com/softistx/nxgt-graphql/commit/a7c9b15fca045144a7667c022aebe8e651b6f75a) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Ship `graphql/scalars.graphqls`, the SDL of every scalar, and an `nxgt-graphql-scalars` bin whose `typedefs [<Name>...] [--out [<file>]]` command prints or writes it, for IDEs and servers that scan `.graphql(s)` files. `--out` alone writes `generated/graphql/scalars.graphqls`.
  
  `pickScalars` refuses a name only `Object.prototype` has (`toString`, `constructor`), as it refuses any unknown name: an untyped caller used to get past its check.

## 0.2.0

### Minor Changes

- [#21](https://github.com/softistx/nxgt-graphql/pull/21) [`c90bba4`](https://github.com/softistx/nxgt-graphql/commit/c90bba44a284d16779039764dc22e05ce4a92ff4) Thanks [@SteveGT96](https://github.com/SteveGT96)! - **Breaking for 0.1.0 users.** An audit of every scalar, so that no input is rewritten on its way in and Node, Bun and browsers give the same answer. Five scalars of 0.1.0 change here (`PositiveInt`, in the number changeset, makes six in all):
  - `URL` refuses what it used to take: an uppercase scheme (`HTTPS://`); an empty host (`https:///x.com`); user info (`https://user:pass@x.com`); a host that is neither a `Hostname`, a canonical IPv4 nor a bracketed IPv6 (`https://123`, `https://0x7f.1`, `https://a_b.com`, `https://-a.com`, `https://x.com..`, a percent-encoded host, a `\` in the authority), Unicode host names included — send the punycode form (`https://xn--bcher-kva.example`); a port with a leading zero or nothing after `:`; and white space, a control or an invisible format character anywhere, the path and query included. Such a value used to be trimmed, or its tabs and line breaks dropped; now it is refused, as a client's input and as a resolver's result (`' https://x.com'` no longer serializes). An uppercase host, `:443`, dot segments and percent-escapes in the path are still taken, kept as sent. `urlSchema` (`schemas.url`) is now typed `z.ZodString`, not `z.ZodURL`.
  - `DateTime` refuses the offset `-00:00` (RFC 3339's "local offset unknown"); send `Z` or `+00:00`. It also refuses, both ways, an instant outside 0000-01-01 to 9999-12-31 in UTC (`0000-01-01T00:00:00+01:00`), which it took but could not serialize. A fraction past milliseconds is cut to three digits before it is read, the same in every engine.
  - `EmailAddress` checks its domain by `Hostname`'s rule, with at least two labels and a last label of letters or `xn--`: `u@x.xn--p1ai` is now taken; `u@a-.com`, a label past 63 characters and a domain past 253 are refused.
  - `UUID` takes the max UUID in any case (`FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF`). `uuidSchema` (`schemas.uuid`) is now typed `z.ZodCustomStringFormat<'uuid'>`, not `z.ZodUUID`; its issue keeps `format: 'uuid'` and `Invalid UUID`.
  - `NonEmptyString`'s message is `Invalid string: empty or only white space`, not `Must not be empty or blank`.
  
  `Date` points `@specifiedBy` at RFC 3339 section 5.6, as `Time` does.
  
  Every message of the package's own reads `Invalid <format>[: hint]`, the hint saying what to send: `Invalid IP address: expected IPv4 or IPv6`, `Invalid JSON value`, `Invalid JSON object`, `Invalid void: expected null`, `Invalid hexadecimal: expected at least one digit`, `Invalid integer: write -0 as 0`, `Invalid integer: no leading zero and no "-0"`, `Invalid integer: expected a decimal string or a safe integer`. `MAC` and every hex format take any case, mixed included, kept as sent. `IP` points `@specifiedBy` at RFC 4291.

- [#2](https://github.com/softistx/nxgt-graphql/pull/2) [`134fa04`](https://github.com/softistx/nxgt-graphql/commit/134fa048812d1e166d1d4e18601ed286000d13d9) Thanks [@SteveGT96](https://github.com/SteveGT96)! - `pickScalars('DateTime', 'URL')` returns the `typeDefs` and `resolvers` of those scalars only, with the names checked by the compiler, for a schema-first server that does not want every scalar in its SDL. Each scalar's schema is also exported on its own (`dateTimeSchema`, `urlSchema`, …) beside `schemas`, whose keys are unchanged. New types: `ZodScalar<S, N>`, which `zodScalar` now returns (a `GraphQLScalarType` whose `name` is the literal GraphQL name), `ScalarName`, `ScalarResolvers` and `Schemas`.
  
  `scalarTypeDefs`, `scalarResolvers` and `schemas` now list the scalars in the code-unit order of their names (Date, DateTime, EmailAddress, NonEmptyString, PositiveInt, URL, UUID). An upper-case letter sorts before a lower-case one: `scalarTypeDefs` and `scalarResolvers` follow the `…Scalar` export names (`HSLA` before `HSL`, `HSL` before `HexColorCode`), `schemas` the `…Schema` names (`hsl` before `hsla`). 0.1.0 used declaration order. They declare the same scalars; only a snapshot of the SDL string sees a difference.

- [#17](https://github.com/softistx/nxgt-graphql/pull/17) [`2934ba0`](https://github.com/softistx/nxgt-graphql/commit/2934ba019112b4d5a581b5c7113d88a411e00910) Thanks [@SteveGT96](https://github.com/SteveGT96)! - A new `color` category. Each scalar takes one canonical spelling and keeps it as sent:
  - `HexColorCode`: `#` followed by 3, 4, 6 or 8 hexadecimal digits, in either case.
  - `RGB` and `RGBA`: CSS comma syntax, `rgb(255, 0, 0)` and `rgba(255, 0, 0, 0.5)`, with integer components from 0 to 255.
  - `HSL` and `HSLA`: CSS comma syntax, `hsl(120, 100%, 50%)` and `hsla(120, 100%, 50%, 0.5)`. The hue runs from 0 to 359 and the percentages from 0 to 100.
  
  The alpha is `0`, `1` or a fraction such as `0.5`. Percentages for RGB, the space-separated syntax, units, and spacing other than `", "` are all refused.

- [#12](https://github.com/softistx/nxgt-graphql/pull/12) [`0b1a970`](https://github.com/softistx/nxgt-graphql/commit/0b1a970f7deb1350df77eeab924d1ca1bbd76315) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Seven `date-time` scalars:
  - `Time`: RFC 3339 `full-time` with its offset, such as `10:15:30Z`.
  - `LocalTime`: `10:15` or `10:15:30`, with no offset.
  - `LocalDateTime`: `2024-03-10T10:15:30`, with no offset, not even `Z`.
  - `Duration`: ISO 8601, such as `P1DT2H`.
  - `UtcOffset`: `-12:00` to `+14:00`. `-00:00` is refused, as by `Time` and `DateTime`: `Invalid offset: write no offset as +00:00`.
  - `TimeZone`: an IANA name the runtime's `Intl` knows, aliases included, in its own case and kept as sent.
  - `Timestamp`: an integer of milliseconds since 1970 on the wire and a `Date` in resolvers. An invalid `Date` is refused on the way out.
  
  Every one except `Timestamp` is a string on both sides.

- [#9](https://github.com/softistx/nxgt-graphql/pull/9) [`ad24cd8`](https://github.com/softistx/nxgt-graphql/commit/ad24cd811cb13196b2b3c6a2f0c5093bb916baf1) Thanks [@SteveGT96](https://github.com/SteveGT96)! - A new `encoding` category with six scalars, each a string on both sides:
  - `Base64` (padded) and `Base64URL` (unpadded), canonical spelling only: `YR==` decodes to the same byte as `YQ==` and is refused.
  - `Hexadecimal`: not empty, any case, no `0x`.
  - `JWT`: the compact form (RFC 7519 and 7515), each part canonical base64url as `Base64URL` takes it. The header and the payload must be JSON objects and the signature must not be empty. The header's `alg` must be a non-empty string other than `none`, so an unsecured token is refused even when it carries a signature. The signature itself is not verified.
  - `SHA256` and `SHA512`: hex digests.

- [#16](https://github.com/softistx/nxgt-graphql/pull/16) [`08c18b5`](https://github.com/softistx/nxgt-graphql/commit/08c18b525f9cc042815b4f12f0d7c71002b5946d) Thanks [@SteveGT96](https://github.com/SteveGT96)! - A new `finance` category:
  - `IBAN`: an IBAN in its electronic form, uppercase with no spaces. Its country must be in the SWIFT IBAN registry, embedded in the package, its length must be that country's, and its mod-97 check digits must hold. The printed form in groups of four is refused, not rewritten.
  - `Currency`: an ISO 4217 code in force, uppercase, from Zod's list. A withdrawn code such as `FRF` or `HRK` is refused.

- [#15](https://github.com/softistx/nxgt-graphql/pull/15) [`f34b612`](https://github.com/softistx/nxgt-graphql/commit/f34b61243d8acd9f9047e649fcac06490cf812a8) Thanks [@SteveGT96](https://github.com/SteveGT96)! - A new `geo` category:
  - `Latitude`: a finite number of decimal degrees from -90 to 90.
  - `Longitude`: a finite number of decimal degrees from -180 to 180.
  
  Both are numbers on both sides. A string, such as `"48.8566"` or a degrees-minutes-seconds form, is refused.

- [#7](https://github.com/softistx/nxgt-graphql/pull/7) [`ecf66c8`](https://github.com/softistx/nxgt-graphql/commit/ecf66c8ea20aa8c3c0715c26a7cf15cc31a59cbd) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Eleven `identifier` scalars, each a string on both sides and kept as sent:
  - `GUID`: any 8-4-4-4-12 hex, with no version check.
  - `UUIDv4` and `UUIDv7`.
  - `ULID` in either case, kept as sent. `XID` is lowercase only, as rs/xid reads it, and its last character is `0` or `g`.
  - `Cuid2`: a lowercase letter first, 2 to 32 characters in all. This is tighter than Zod's `z.cuid2()`, which takes `1abc`.
  - `NanoID`: the 21-character default.
  - `KSUID`, up to its 160-bit maximum.
  - `ObjectID`: 24 hex digits.
  - `ISBN`: ISBN-10 or ISBN-13, digits only, with the check digit verified (979-0, the ISMN range, refused).
  - `SemVer`: semver.org's own regular expression, so `v1.2.3` is refused.

- [#14](https://github.com/softistx/nxgt-graphql/pull/14) [`493f19b`](https://github.com/softistx/nxgt-graphql/commit/493f19bf483dd57f3738e067d3695c99a99fa456) Thanks [@SteveGT96](https://github.com/SteveGT96)! - A new `locale` category:
  - `CountryCode`: an ISO 3166-1 alpha-2 code, uppercase, from the 249 officially assigned codes embedded in the package. `UK`, `EU` and `XK` are refused.
  - `Locale`: a well-formed BCP 47 tag in canonical case, such as `fr-FR` or `zh-Hant-TW`, kept as sent. `fr-fr` and `en_US` are refused rather than rewritten. An alias (`tl`, `iw`) is taken: the case rule is the package's own, so the answer is the same on Node, Bun and browsers. Extensions are checked by the package too: lowercase, singletons in order, `-u-` attributes then keywords sorted by key, `-t-` fields sorted by key, an alias kept as sent (`en-t-iw`, `en-u-ca-islamicc`); `-x-` ends the order rules: what follows is private use, only required to be lowercase (`en-x-Foo` is refused).

- [#5](https://github.com/softistx/nxgt-graphql/pull/5) [`cb4383c`](https://github.com/softistx/nxgt-graphql/commit/cb4383cf9680ce5e46350169838ff89e4a80bd40) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Eight `network` scalars: `IPv4`, `IPv6`, `IP` (either one), `CIDRv4`, `CIDRv6`, `MAC`, `Hostname` and `PhoneNumber` (E.164, such as `+33612345678`). Each is a string on both sides. `IPv4`, `IPv6`, `CIDRv4`, `CIDRv6` and `PhoneNumber` are checked by Zod's own format; `IP` is either of the first two; `Hostname` is Zod's format with one more rule, below; `MAC` is the package's own pattern, since Zod's takes one case per address.
  - `IPv6` takes every RFC 4291 text form but no zone (`%eth0`).
  - `MAC` takes six colon-separated pairs, in any case, kept as sent.
  - `Hostname` follows RFC 1123: a last label that is all digits is refused, so an IPv4 address is not a host name, and so is a last label that a URL parser reads as a number (`a.0x7f`); a trailing dot is allowed.

- [#4](https://github.com/softistx/nxgt-graphql/pull/4) [`a50dc47`](https://github.com/softistx/nxgt-graphql/commit/a50dc47f2549560c44fb34846f5be213c8f5c39b) Thanks [@SteveGT96](https://github.com/SteveGT96)! - **Breaking for 0.1.0 users, `PositiveInt`:** a query literal `1.0` used to be read as 1 and is now refused with `PositiveInt cannot represent a FloatValue literal`. A JSON variable `1.0` is still the number 1.
  
  Eleven `number` scalars. `NegativeInt`, `NonNegativeInt` and `NonPositiveInt` are 32 bits, like `PositiveInt`. `PositiveFloat`, `NegativeFloat`, `NonNegativeFloat` and `NonPositiveFloat` take finite numbers only. `SafeInt` covers ±(2⁵³ − 1) and `Port` 0 to 65535. `Long` (signed 64-bit) and `BigInt` (unbounded) are a `bigint` in the resolvers and a decimal string on the wire. As input they take a canonical decimal string, or a safe-integer number. A resolver that returns a `number` for them is refused, and so is a query literal past 2⁵³ written as a number: it is never rounded.
  
  A number past 2⁵³ for `Long` or `BigInt` is refused with `Invalid integer: past 2^53, write it as a string`.
  
  `zodScalar` takes `literals: 'integer'`. With it, a float literal such as `1.0` or `1e3` is refused, as GraphQL's `Int` refuses it. Every integer scalar here uses it and also refuses `-0`.

- [#20](https://github.com/softistx/nxgt-graphql/pull/20) [`7c2e798`](https://github.com/softistx/nxgt-graphql/commit/7c2e798ea2cea09d6b2a4f6ec633a331cbc12441) Thanks [@SteveGT96](https://github.com/SteveGT96)! - `Emoji`, in the `string` category: exactly one emoji, as one user-perceived character. Skin tones, ZWJ sequences, flags and keycaps all count as one (`👍🏽`, `👨‍👩‍👧`, `🇫🇷`, `1️⃣`). Two emoji side by side, text around one, a lone joiner or skin tone, a trailing joiner, two variation selectors or two skin tones in a row, a lone regional indicator, or more than 32 code points is refused. It needs `Intl.Segmenter` (Firefox 125, Safari 14.1), built on first use, so a runtime without it fails `Emoji` alone.

- [#19](https://github.com/softistx/nxgt-graphql/pull/19) [`56e3e1c`](https://github.com/softistx/nxgt-graphql/commit/56e3e1c1f273e55f6c2a1296c1165f8df7c61900) Thanks [@SteveGT96](https://github.com/SteveGT96)! - A new `value` category:
  - `JSON`: any JSON value.
  - `JSONObject`: a plain JSON object.
  - `Void`: `null` only, for a field that only acts.
  
  `JSON` and `JSONObject` read every query literal, objects and lists included, with variables inside them. A variable inside a literal reads the same on graphql 16 as on 17: left out, it drops an object field and makes a list item `null`. They refuse, both ways, what JSON cannot write back as it is: a cycle, `undefined`, an array hole, a `Date`, `NaN`, `-0` (written `0`), or nesting past 1000 levels.
  
  `zodScalar` takes a new `literals: 'any'` option for a scalar of your own that holds JSON.

## 0.1.0

### Minor Changes

- [`a654c6f`](https://github.com/softistx/nxgt-graphql/commit/a654c6f5283a6472a162d47b50b266ac97fdf0c4) - First release: `zodScalar(schema, { name })` builds a GraphQL scalar whose inputs are decoded and results encoded by one Zod schema, and seven scalars are built on it — `DateTime`, `Date`, `EmailAddress`, `URL`, `UUID`, `NonEmptyString`, `PositiveInt` — with `scalarTypeDefs` and `scalarResolvers` for schema-first servers and `schemas` for use outside GraphQL. Works with graphql 16 and 17.
