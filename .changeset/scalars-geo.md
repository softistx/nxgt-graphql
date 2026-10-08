---
'@nxgt/graphql-scalars': minor
---

A new `geo` category:
- `Latitude`: a finite number of decimal degrees from -90 to 90.
- `Longitude`: a finite number of decimal degrees from -180 to 180.

Both are numbers on both sides. A string, such as `"48.8566"` or a degrees-minutes-seconds form, is refused.
