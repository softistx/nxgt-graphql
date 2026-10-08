---
'@nxgt/graphql-scalars': minor
---

`scalarSchemas`: the schema behind each scalar, keyed by its GraphQL name (`scalarSchemas.DateTime` is `dateTimeSchema`), typed exactly, for code generated from a GraphQL schema such as `@nxgt/graphql-codegen-zod`'s. Each is the schema the scalar checks, so `z.decode` on a wire value gives what a resolver receives. A `zodScalar` now carries its schema as `.schema`, with its type (`ZodScalar<S, N>['schema']` is `S`); the new `ScalarSchemas` type maps a name to it.
