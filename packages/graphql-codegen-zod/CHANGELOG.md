# @nxgt/graphql-codegen-zod

## 0.1.0

### Minor Changes

- [#37](https://github.com/softistx/nxgt-graphql/pull/37) [`348a687`](https://github.com/softistx/nxgt-graphql/commit/348a687eb8734f9981b959a49ba8917bda2b5fb8) Thanks [@SteveGT96](https://github.com/SteveGT96)! - New package: a graphql-codegen plugin that writes Zod schemas and their types from your SDL. It covers every enum and input type, the arguments of each field, and the variables of each named operation in `documents`. Each schema carries the `@constraint` rules of `@nxgt/graphql-validation`, so a client refuses what the server refuses. A schema `withValidation` would refuse is refused with the same message. Schemas are named `zSignUpInput`, and types keep the typescript plugins' names (`SignUpInput`, `MutationSignUpArgs`, `SignUpMutationVariables`). Arguments and inputs are typed as the resolver receives them, variables as the client sends them, and defaults are optional on the way in and present on the way out. Custom scalars come from a `scalarSchemas` record (`@nxgt/graphql-scalars` from 0.4.0) or from one export each (`zodScalars`). A list takes a single value as `graphql` does, at any depth; an `ID` is a string. An input type in a cycle has its types written out (`Filter`, `FilterInput`). Recursive inputs use Zod getters, and `@oneOf` inputs become a union. graphql 16 and 17.

### Patch Changes

- Updated dependencies [[`bef8114`](https://github.com/softistx/nxgt-graphql/commit/bef8114b0d408559363b4d5ae57f5989eb7265be)]:
  - @nxgt/graphql-validation@0.2.0
