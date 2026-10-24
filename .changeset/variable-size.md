---
"@nxgt/graphql-validation": minor
---

`maxListCost` now counts a size given as a variable (or an unusable literal) at its `@constraint(max)` or the new `variableSize` option, never below its SDL default, so a cost can rise.
