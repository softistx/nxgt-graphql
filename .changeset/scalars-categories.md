---
'@nxgt/graphql-scalars': minor
---

`pickScalars('DateTime', 'URL')` returns the `typeDefs` and `resolvers` of those scalars only, with the names checked by the compiler, for a schema-first server that does not want every scalar in its SDL. Each scalar's schema is also exported on its own (`dateTimeSchema`, `urlSchema`, …) beside `schemas`, whose keys are unchanged. New types: `ZodScalar<S, N>`, which `zodScalar` now returns (a `GraphQLScalarType` whose `name` is the literal GraphQL name), `ScalarName`, `ScalarResolvers` and `Schemas`.

`scalarTypeDefs`, `scalarResolvers` and `schemas` now list the scalars in the alphabetical order of their export (Date, DateTime, EmailAddress, NonEmptyString, PositiveInt, URL, UUID), where 0.1.0 used declaration order. They declare the same scalars; only a snapshot of the SDL string sees a difference.
