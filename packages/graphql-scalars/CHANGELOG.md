# @nxgt/graphql-scalars

## 0.1.0

### Minor Changes

- [`a654c6f`](https://github.com/softistx/nxgt-graphql/commit/a654c6f5283a6472a162d47b50b266ac97fdf0c4) - First release: `zodScalar(schema, { name })` builds a GraphQL scalar whose inputs are decoded and results encoded by one Zod schema, and seven scalars are built on it — `DateTime`, `Date`, `EmailAddress`, `URL`, `UUID`, `NonEmptyString`, `PositiveInt` — with `scalarTypeDefs` and `scalarResolvers` for schema-first servers and `schemas` for use outside GraphQL. Works with graphql 16 and 17.
