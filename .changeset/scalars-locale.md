---
'@nxgt/graphql-scalars': minor
---

A new `locale` category:
- `CountryCode`: an ISO 3166-1 alpha-2 code, uppercase, from the 249 officially assigned codes embedded in the package. `UK`, `EU` and `XK` are refused.
- `Locale`: a well-formed BCP 47 tag in canonical case, such as `fr-FR` or `zh-Hant-TW`, kept as sent. `fr-fr` and `en_US` are refused rather than rewritten. An alias (`tl`, `iw`) is taken: the case rule is the package's own, so the answer is the same on Node, Bun and browsers.
