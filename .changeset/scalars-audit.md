---
'@nxgt/graphql-scalars': minor
---

**Breaking for 0.1.0 users.** An audit of every scalar, so that no input is rewritten on its way in and Node, Bun and browsers give the same answer. Five scalars of 0.1.0 change:
- `URL` refuses what it used to take: an uppercase scheme (`HTTPS://`); an empty host (`https:///x.com`); user info (`https://user:pass@x.com`); a host that is neither a `Hostname`, a canonical IPv4 nor a bracketed IPv6 (`https://123`, `https://0x7f.1`, `https://a_b.com`, `https://-a.com`, `https://x.com..`, a percent-encoded host, a `\` in the authority), Unicode host names included — send the punycode form (`https://xn--bcher-kva.example`); a port with a leading zero or nothing after `:`; and white space, a control or an invisible format character anywhere, the path and query included. Such a value used to be trimmed, or its tabs and line breaks dropped; now it is refused, as a client's input and as a resolver's result (`' https://x.com'` no longer serializes). An uppercase host, `:443`, dot segments and percent-escapes in the path are still taken, kept as sent. `urlSchema` (`schemas.url`) is now typed `z.ZodString`, not `z.ZodURL`.
- `DateTime` refuses the offset `-00:00` (RFC 3339's "local offset unknown"); send `Z` or `+00:00`. It also refuses, both ways, an instant outside 0000-01-01 to 9999-12-31 in UTC (`0000-01-01T00:00:00+01:00`), which it took but could not serialize. A fraction past milliseconds is cut to three digits before it is read, the same in every engine.
- `EmailAddress` checks its domain by `Hostname`'s rule, with at least two labels and a last label of letters or `xn--`: `u@x.xn--p1ai` is now taken; `u@a-.com`, a label past 63 characters and a domain past 253 are refused.
- `UUID` takes the max UUID in any case (`FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF`). `uuidSchema` (`schemas.uuid`) is now typed `z.ZodCustomStringFormat<'uuid'>`, not `z.ZodUUID`; its issue keeps `format: 'uuid'` and `Invalid UUID`.
- `NonEmptyString`'s message is `Invalid string: empty or only white space`, not `Must not be empty or blank`.

`Date` points `@specifiedBy` at RFC 3339 section 5.6, as `Time` does.

Every message of the package's own reads `Invalid <format>[: hint]`, the hint saying what to send: `Invalid IP address: expected IPv4 or IPv6`, `Invalid JSON value`, `Invalid JSON object`, `Invalid void: expected null`, `Invalid hexadecimal: expected at least one digit`, `Invalid integer: write -0 as 0`, `Invalid integer: no leading zero and no "-0"`, `Invalid integer: expected a decimal string or a safe integer`. `MAC` and every hex format take any case, mixed included, kept as sent. `IP` points `@specifiedBy` at RFC 4291.
