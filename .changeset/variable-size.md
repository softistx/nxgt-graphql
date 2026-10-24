---
"@nxgt/graphql-validation": minor
---

`maxListCost` now counts a size given as a variable (or an unusable literal) at its declared `@constraint(max)` or `exclusiveMax` (a fractional bound is rounded up, the largest counts) or the new `variableSize` option, never below its SDL default, so a cost can rise. The operation's own variable default is ignored, since the client can override it.
