---
"@nxgt/graphql-validation": minor
---

`maxDepth({ depth })` and `maxListCost({ budget, defaultFirst })` are graphql-js validation rules (for `validate` and graphql-yoga's `addValidationRule`) that refuse a query nested too deep or whose list-weighted cost is over a budget, with stable `QUERY_TOO_DEEP` and `QUERY_TOO_COSTLY` error codes.
