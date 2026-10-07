---
'@nxgt/graphql-validation': minor
---

New package: validate GraphQL arguments and input fields with `@constraint` directives, checked by Zod schemas. Add `constraintTypeDefs` to your type definitions, then call `withValidation(schema)` once every resolver is attached. Each constrained field is then checked before its resolver runs, through nested input types and lists, and the resolver receives the parsed arguments. An invalid input becomes one `GraphQLError` with `extensions.code` `BAD_USER_INPUT` and an `issues` list, each issue with its path inside the arguments. `validated(schema, resolver)` covers the rules a directive cannot express, with the same error. The formats are byte, date-time, date, email, ipv4, ipv6, uri and uuid. graphql 16 and 17.
