---
"@nxgt/graphql-codegen-zod": minor
---

New package: a graphql-codegen plugin that writes Zod schemas and their types from your SDL. It covers every enum and input type, the arguments of each field, and the variables of each named operation in `documents`. Each schema carries the `@constraint` rules of `@nxgt/graphql-validation`, so a client refuses what the server refuses. A schema `withValidation` would refuse is refused with the same message. Schemas are named `zSignUpInput`, and types keep the typescript plugins' names (`SignUpInput`, `MutationSignUpArgs`, `SignUpMutationVariables`). Arguments and inputs are typed as the resolver receives them, variables as the client sends them, and defaults are optional on the way in and present on the way out. Custom scalars come from a `scalarSchemas` record (`@nxgt/graphql-scalars` from 0.4.0) or from one export each (`scalars`). Recursive inputs use Zod getters, and `@oneOf` inputs become a union. graphql 16 and 17.
