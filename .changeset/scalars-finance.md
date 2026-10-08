---
'@nxgt/graphql-scalars': minor
---

A new `finance` category:
- `IBAN`: an IBAN in its electronic form, uppercase with no spaces. Its country must be in the SWIFT IBAN registry, embedded in the package, its length must be that country's, and its mod-97 check digits must hold. The printed form in groups of four is refused, not rewritten.
- `Currency`: an ISO 4217 code in force, uppercase, from Zod's list. A withdrawn code such as `FRF` or `HRK` is refused.
