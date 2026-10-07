---
'@nxgt/graphql-scalars': minor
---

First release: `zodScalar(schema, { name })` builds a GraphQL scalar whose inputs are decoded and results encoded by one Zod schema, and seven scalars are built on it — `DateTime`, `Date`, `EmailAddress`, `URL`, `UUID`, `NonEmptyString`, `PositiveInt` — with `scalarTypeDefs` and `scalarResolvers` for schema-first servers and `schemas` for use outside GraphQL. Works with graphql 16 and 17.
