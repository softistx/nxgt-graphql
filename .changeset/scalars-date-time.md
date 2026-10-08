---
'@nxgt/graphql-scalars': minor
---

Seven `date-time` scalars:
- `Time`: RFC 3339 `full-time` with its offset, such as `10:15:30Z`.
- `LocalTime`: `10:15` or `10:15:30`, with no offset.
- `LocalDateTime`: `2024-03-10T10:15:30`, with no offset, not even `Z`.
- `Duration`: ISO 8601, such as `P1DT2H`.
- `UtcOffset`: `-12:00` to `+14:00`. `-00:00` is refused, as by `Time` and `DateTime`: `Invalid offset: write no offset as +00:00`.
- `TimeZone`: an IANA name the runtime's `Intl` knows, aliases included, in its own case and kept as sent.
- `Timestamp`: an integer of milliseconds since 1970 on the wire and a `Date` in resolvers. An invalid `Date` is refused on the way out.

Every one except `Timestamp` is a string on both sides.
