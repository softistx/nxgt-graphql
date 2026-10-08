---
'@nxgt/graphql-scalars': minor
---

Eleven `identifier` scalars, each a string on both sides and kept as sent:
- `GUID`: any 8-4-4-4-12 hex, with no version check.
- `UUIDv4` and `UUIDv7`.
- `ULID` in either case, kept as sent. `XID` is lowercase only, as rs/xid reads it, and its last character is `0` or `g`.
- `Cuid2`: a lowercase letter first, 2 to 32 characters in all. This is tighter than Zod's `z.cuid2()`, which takes `1abc`.
- `NanoID`: the 21-character default.
- `KSUID`, up to its 160-bit maximum.
- `ObjectID`: 24 hex digits.
- `ISBN`: ISBN-10 or ISBN-13, digits only, with the check digit verified (979-0, the ISMN range, refused).
- `SemVer`: semver.org's own regular expression, so `v1.2.3` is refused.
