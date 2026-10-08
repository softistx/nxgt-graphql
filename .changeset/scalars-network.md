---
'@nxgt/graphql-scalars': minor
---

Eight `network` scalars: `IPv4`, `IPv6`, `IP` (either one), `CIDRv4`, `CIDRv6`, `MAC`, `Hostname` and `PhoneNumber` (E.164, such as `+33612345678`). Each is a string on both sides, checked by Zod's own format, `MAC` excepted.
- `IPv6` takes every RFC 4291 text form but no zone (`%eth0`).
- `MAC` takes six colon-separated pairs, in any case, kept as sent.
- `Hostname` follows RFC 1123: a last label that is all digits is refused, so an IPv4 address is not a host name, and so is a last label that a URL parser reads as a number (`a.0x7f`); a trailing dot is allowed.
