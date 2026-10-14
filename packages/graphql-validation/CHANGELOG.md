# @nxgt/graphql-validation

## 0.5.0

### Minor Changes

- [#105](https://github.com/softistx/nxgt-graphql/pull/105) [`4f8b990`](https://github.com/softistx/nxgt-graphql/commit/4f8b9906c9f519c37f89ed2d03a90515127a7508) Thanks [@SteveGT96](https://github.com/SteveGT96)! - `validated` accepts a function in place of the schema (or shape), `(context, info) => schema | shape` (or a promise of either), for checks that need the request: a uniqueness query in the request's database, a rule that depends on the viewer. It is called on each call; its result is parsed like a fixed schema, with the same `BAD_USER_INPUT` error, and what it throws reaches the client as it is. New type `ArgsSchemaFor`.
  
  Fix: the arguments of a resolver given a shape (`validated({ a: z.string() }, (_, { a }) => …)`) were typed `unknown`; they now have the shape's types. A shape that disagrees with the field's arguments (e.g. `z.string()` for a nullable argument), or a read of a key not in the shape, now fails to compile where it compiled before.

## 0.4.1

### Patch Changes

- [#99](https://github.com/softistx/nxgt-graphql/pull/99) [`f04d08c`](https://github.com/softistx/nxgt-graphql/commit/f04d08c9fc179efd259ab38cfe7dc8c5ca84f254) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Docs: from zod 4.6.6, a list longer than `maxItems` is refused with one `too_big` issue at the list's path and none for its items, since zod stops an oversized array before parsing them.

## 0.4.0

### Minor Changes

- [#87](https://github.com/softistx/nxgt-graphql/pull/87) [`3e30d35`](https://github.com/softistx/nxgt-graphql/commit/3e30d35534c3ff8c74437ec2c8dfc527e3be3f86) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Answering invalid input as one error: for an API that answers invalid input as one 400 error with a list of fields, `invalidInputError(issues, { translate })` builds that `GraphQLError`. Its `extensions` are `{ code: 'validation.errors.invalid-input', http: { status: 400 }, fields }`, each field `{ path, code, message, params? }` in the order given, its message `translate(code, params)` or the code itself without a translator. `params` is written only when it has a key, never `{}`. `fieldsError(code, issues, { translate, status, params })` does the same for a refusal of your own that names the fields at fault (a 409 conflict, say): `extensions` `{ code, params?, http?, fields }`. Both keep `GraphQLError`'s own options (`originalError`, `path`, `nodes`, …) but replace any `extensions` among them. `fieldIssueOf(zodIssue)` maps a Zod issue to a field: its path through `inputPath`, and a code under `validation.errors.` without params, `too-short` / `too-long` (a string's length), `out-of-range` (a number's or bigint's bound, a multiple), `too-few` / `too-many` (a list's or set's size), `invalid-format` (a named format or a pattern) or `invalid` (anything else, a prefix, suffix or substring included), the codes also exported as `FIELD_CODES`; `@nxgt/graphql-codegen-msw`'s mocks apply the same mapping. `inputPath(['input', 'person', 'firstName'])` gives `person.firstName`, to map a Zod issue or a `BAD_USER_INPUT` issue to a field; it takes any `PropertyKey[]`, a Zod path as it is, a symbol written as `String(key)`. Also exported: `INVALID_INPUT` and the types `FieldIssue`, `FieldError`, `IssueParams`, `Translate`, `InvalidInputOptions`, `FieldsErrorOptions`. What `withValidation`, `validated` and `badUserInput` raise is unchanged.

## 0.3.1

### Patch Changes

- [#75](https://github.com/softistx/nxgt-graphql/pull/75) [`0b1fbc7`](https://github.com/softistx/nxgt-graphql/commit/0b1fbc736faf456db7622e08a577a4499a5f62d2) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Your own formats (`withValidation(schema, { formats })`) no longer depend on Zod's internals: each one runs through Zod's public API only (`safeParseAsync`, `check`, `refine`, `catch`), so upgrading to a later Zod 4 release cannot silently break their validation. What you see stays the same: the same accepted and refused values, the same messages with `constraint: "format"`, an aborting check (`abort: true`, or an issue a `.check()` pushes) stopping the rules after it exactly as when they are chained on your schema, the startup refusals and the rewriting check unchanged.
  
  An async check now runs once per value from the very first one, whatever its form (`.refine(async …)`, an async `.superRefine()`, a function returning a promise), and a rejection always fails the operation with its error: none is ever left unhandled. A format from another copy of Zod takes its messages from that copy's own configuration (`z.config()`). A check that throws on a field's default value fails startup with the "checks asynchronously" message rather than its own error. A format object that has a string definition but lacks `safeParseAsync`, `check`, `refine` or `catch` (a hand-built object, a `zod/mini` schema) is refused at startup with a reworded message. The cost is small: about 0.1 µs more per accepted value and 1.5 µs more per refused one, measured on Bun.

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
