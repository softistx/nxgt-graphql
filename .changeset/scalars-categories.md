---
'@nxgt/graphql-scalars': minor
---

`pickScalars('DateTime', 'URL')` returns the `typeDefs` and `resolvers` of those scalars only, with the names checked by the compiler, for a schema-first server that does not want every scalar in its SDL. Each scalar's schema is also exported on its own (`dateTimeSchema`, `urlSchema`, …) beside `schemas`, and `zodScalar` now returns a `ZodScalar<S, N>` whose `name` is the literal GraphQL name. `scalarTypeDefs` and `scalarResolvers` list the scalars in alphabetical order of their export.
