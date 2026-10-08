# @nxgt/graphql-validation

## 0.2.0

### Minor Changes

- [#36](https://github.com/softistx/nxgt-graphql/pull/36) [`bef8114`](https://github.com/softistx/nxgt-graphql/commit/bef8114b0d408559363b4d5ae57f5989eb7265be) Thanks [@SteveGT96](https://github.com/SteveGT96)! - New subpath `@nxgt/graphql-validation/codegen` for code generators, read by the new `@nxgt/graphql-codegen-zod`. `inputCode(type, constraints, where, named, options?)` writes the schema of an argument or input field as source; `options.list` lets a generator rewrite each list, for example to take a single value as graphql does. It applies the same rules as `withValidation`, and a constraint that cannot apply is refused with the same message as at startup. It comes with `constraintsOn` and the `Constraint` type, and with `checkConstraints(schema)`, which runs every startup check of `withValidation` without wrapping anything, so a generator refuses the same schemas. Servers keep using the main entry.

## 0.1.0

### Minor Changes

- [#6](https://github.com/softistx/nxgt-graphql/pull/6) [`0faf6d6`](https://github.com/softistx/nxgt-graphql/commit/0faf6d622226bb7c7c6856568da28aacbe21179c) Thanks [@SteveGT96](https://github.com/SteveGT96)! - New package: validate GraphQL arguments and input fields with `@constraint` directives, checked by Zod schemas. Add `constraintTypeDefs` to your type definitions, then call `withValidation(schema)` once every resolver is attached. Each constrained field is then checked before its resolver runs, through nested input types and lists, and the resolver receives the parsed arguments. An invalid input becomes one `GraphQLError` with `extensions.code` `BAD_USER_INPUT` and an `issues` list. Each issue carries its path inside the arguments, and the `@constraint` argument that refused it (`constraint: 'minLength'`). `validated(schema, resolver)` covers the rules a directive cannot express, with the same error. Startup refuses any `@constraint` that cannot apply, a `@constraint` declared otherwise than `constraintTypeDefs`, and a default value that breaks its own constraint. For IDE support, the directive's SDL ships as `graphql/constraint.graphqls`, and `nxgt-graphql-validation typedefs --out` writes it into a project (`generated/graphql/constraint.graphqls` by default). The formats are byte, date-time, date, email, ipv4, ipv6, uri and uuid. graphql 16 and 17.
