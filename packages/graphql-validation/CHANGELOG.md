# @nxgt/graphql-validation

## 0.3.0

### Minor Changes

- [#66](https://github.com/softistx/nxgt-graphql/pull/66) [`da548c1`](https://github.com/softistx/nxgt-graphql/commit/da548c1bb60e6e02aa8e1db4e1a1b6e749d7f33e) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Your own formats: `withValidation(schema, { formats })` takes a record of Zod string schemas (`z.string()` or a string format, never transformed) that `@constraint(format: "...")` may name beside the built-in ones. Their refusals carry `constraint: "format"` whatever their Zod code, and their own messages; a check with `abort: true` stops the rules after it, as in a generated client. A bad name, a built-in name (also a type error), a schema that is not a string's, one zod cannot run (a string definition with no `_zod.run`), or one that rewrites the value (`.trim()`, `.toLowerCase()`, `.toUpperCase()`, `.normalize()`, `.slugify()`, `.overwrite()`, `z.url()`, `z.httpUrl()`, `.url()`, `z.coerce.string()`, so the server and a generated client never check different values) is refused at startup, and so is wrapping a schema again with other formats. A custom `.check()` that rewrites the value, which no definition shows, fails the request it rewrites with an error naming the format. `checkConstraints` and `inputCode` from `./codegen` take the same record as an optional last parameter, and `inputCode`'s new `format` option writes the source of one of them (a reference to the application's schema, which the other rules narrow). An async check (`.refine(async …)`) works in a request, once per value, whether the format comes from this package's zod or another copy; on a field with a default value, which is checked synchronously at startup, it fails startup with an error naming the field and the format.

### Patch Changes

- [#72](https://github.com/softistx/nxgt-graphql/pull/72) [`c4e214e`](https://github.com/softistx/nxgt-graphql/commit/c4e214e980e10041fa987e8af1d5bf13df5dd8ea) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The `typescript` peer now accepts TypeScript 7 as well (`^6.0.3 || ^7.0.0`). The declarations are checked under both; nothing in these packages calls the TypeScript API at runtime.

## 0.2.1

### Patch Changes

- [#53](https://github.com/softistx/nxgt-graphql/pull/53) [`bdbdb9a`](https://github.com/softistx/nxgt-graphql/commit/bdbdb9a90eb041915315f962b5021beaaca51131) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The declaration files now import each other with a `.js` extension, so a project with `moduleResolution: "nodenext"` (or `node16`) sees every export: `import { scalarSchemas } from '@nxgt/graphql-scalars'` failed there with TS2305, and so did the file `@nxgt/graphql-codegen-zod` generates.

## 0.2.0

### Minor Changes

- [#36](https://github.com/softistx/nxgt-graphql/pull/36) [`bef8114`](https://github.com/softistx/nxgt-graphql/commit/bef8114b0d408559363b4d5ae57f5989eb7265be) Thanks [@SteveGT96](https://github.com/SteveGT96)! - New subpath `@nxgt/graphql-validation/codegen` for code generators, read by the new `@nxgt/graphql-codegen-zod`. `inputCode(type, constraints, where, named, options?)` writes the schema of an argument or input field as source; `options.list` lets a generator rewrite each list, for example to take a single value as graphql does. It applies the same rules as `withValidation`, and a constraint that cannot apply is refused with the same message as at startup. It comes with `constraintsOn` and the `Constraint` type, and with `checkConstraints(schema)`, which runs every startup check of `withValidation` without wrapping anything, so a generator refuses the same schemas. Servers keep using the main entry.

## 0.1.0

### Minor Changes

- [#6](https://github.com/softistx/nxgt-graphql/pull/6) [`0faf6d6`](https://github.com/softistx/nxgt-graphql/commit/0faf6d622226bb7c7c6856568da28aacbe21179c) Thanks [@SteveGT96](https://github.com/SteveGT96)! - New package: validate GraphQL arguments and input fields with `@constraint` directives, checked by Zod schemas. Add `constraintTypeDefs` to your type definitions, then call `withValidation(schema)` once every resolver is attached. Each constrained field is then checked before its resolver runs, through nested input types and lists, and the resolver receives the parsed arguments. An invalid input becomes one `GraphQLError` with `extensions.code` `BAD_USER_INPUT` and an `issues` list. Each issue carries its path inside the arguments, and the `@constraint` argument that refused it (`constraint: 'minLength'`). `validated(schema, resolver)` covers the rules a directive cannot express, with the same error. Startup refuses any `@constraint` that cannot apply, a `@constraint` declared otherwise than `constraintTypeDefs`, and a default value that breaks its own constraint. For IDE support, the directive's SDL ships as `graphql/constraint.graphqls`, and `nxgt-graphql-validation typedefs --out` writes it into a project (`generated/graphql/constraint.graphqls` by default). The formats are byte, date-time, date, email, ipv4, ipv6, uri and uuid. graphql 16 and 17.
