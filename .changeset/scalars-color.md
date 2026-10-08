---
'@nxgt/graphql-scalars': minor
---

A new `color` category. Each scalar takes one canonical spelling and keeps it as sent:
- `HexColorCode`: `#` followed by 3, 4, 6 or 8 hexadecimal digits, in either case.
- `RGB` and `RGBA`: CSS comma syntax, `rgb(255, 0, 0)` and `rgba(255, 0, 0, 0.5)`, with integer components from 0 to 255.
- `HSL` and `HSLA`: CSS comma syntax, `hsl(120, 100%, 50%)` and `hsla(120, 100%, 50%, 0.5)`. The hue runs from 0 to 359 and the percentages from 0 to 100.

The alpha is `0`, `1` or a fraction such as `0.5`. Percentages for RGB, the space-separated syntax, units, and spacing other than `", "` are all refused.
