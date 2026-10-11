# @nxgt/graphql-codegen-zod

## 0.3.0

### Minor Changes

- [#67](https://github.com/softistx/nxgt-graphql/pull/67) [`e1d3030`](https://github.com/softistx/nxgt-graphql/commit/e1d3030c553c1bcc46f98bf061ccdc0cba460178) Thanks [@SteveGT96](https://github.com/SteveGT96)! - Your own formats: `formatSchemas: './formats'` names a module exporting the `formatSchemas` record that `withValidation(schema, { formats })` takes, and `zodFormats: { slug: './slug#slugSchema' }` one format, winning over the record. The plugin loads them and checks them, and every default against them, as `withValidation` does; a module it cannot load fails generation rather than being trusted, and so does a format that rewrites the value (`.trim()`, `z.url()`, `z.coerce.string()`, …). The generated file imports your schema and chains the other rules on it (`formatSchemas.slug.max(40)`), so the client refuses what the server refuses, with the same message; the built-in formats stay inline. Requires `@nxgt/graphql-validation` 0.3.

### Patch Changes

- [#72](https://github.com/softistx/nxgt-graphql/pull/72) [`c4e214e`](https://github.com/softistx/nxgt-graphql/commit/c4e214e980e10041fa987e8af1d5bf13df5dd8ea) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The `typescript` peer now accepts TypeScript 7 as well (`^6.0.3 || ^7.0.0`). The declarations are checked under both; nothing in these packages calls the TypeScript API at runtime.
- Updated dependencies [[`da548c1`](https://github.com/softistx/nxgt-graphql/commit/da548c1bb60e6e02aa8e1db4e1a1b6e749d7f33e), [`c4e214e`](https://github.com/softistx/nxgt-graphql/commit/c4e214e980e10041fa987e8af1d5bf13df5dd8ea)]:
  - @nxgt/graphql-validation@0.3.0

## 0.2.2

### Patch Changes

- [#56](https://github.com/softistx/nxgt-graphql/pull/56) [`a7dc63e`](https://github.com/softistx/nxgt-graphql/commit/a7dc63e267543f540215a846a57baa78575a54a5) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The docs show `scalarSchemas: '@nxgt/zod'` for a client: the same scalar schemas as `@nxgt/graphql-scalars`, without `graphql` in the bundle.

## 0.2.1

### Patch Changes

- [#53](https://github.com/softistx/nxgt-graphql/pull/53) [`bdbdb9a`](https://github.com/softistx/nxgt-graphql/commit/bdbdb9a90eb041915315f962b5021beaaca51131) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The declaration files now import each other with a `.js` extension, so a project with `moduleResolution: "nodenext"` (or `node16`) sees every export: `import { scalarSchemas } from '@nxgt/graphql-scalars'` failed there with TS2305, and so did the file `@nxgt/graphql-codegen-zod` generates.
- Updated dependencies [[`bdbdb9a`](https://github.com/softistx/nxgt-graphql/commit/bdbdb9a90eb041915315f962b5021beaaca51131)]:
  - @nxgt/graphql-validation@0.2.1

## 0.2.0

### Minor Changes

- [#49](https://github.com/softistx/nxgt-graphql/pull/49) [`00ed376`](https://github.com/softistx/nxgt-graphql/commit/00ed376de95d8f6aca8e5d8070c87ac65bd19e57) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The plugin now writes the SDL's object types, interfaces and unions: `zUser` and `User`, typed as what a resolver returns (custom scalars decoded, `__typename` optional, unknown fields dropped), and each interface or union as a `z.union` of its object types. An object type in a cycle has its types written out (`User`, and `UserWire` for the wire value), so a long loop of types does not hit TS2589.
  
  On by default, which can break a config that generated with 0.1.0: a custom scalar used only on output fields now needs a schema (`scalarSchemas` or `zodScalars`), and an object type named like a type the plugin already writes (`QueryFindArgs`, `FilterInput`) now clashes. `objects: false` skips the object types; with `operations: false` too, it gives 0.1.0's output back.

- [#50](https://github.com/softistx/nxgt-graphql/pull/50) [`70d6044`](https://github.com/softistx/nxgt-graphql/commit/70d6044c2499b015fc90a20490a0ce3dfedd3e95) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The plugin now writes each named operation's result and each fragment: `zSearchQuery` and `SearchQuery`, `zUserFieldsFragment` and `UserFieldsFragment`, typed as what the response holds (custom scalars decoded, unknown fields dropped, a fragment spread inlined). A selection on an interface or union is a `z.discriminatedUnion` on `__typename`; a field under `@skip`, `@include` or `@defer` is optional. A deep selection is declared apart, so TypeScript infers an operation of any depth.
  
  On by default, which can break a config that generated with the last release: an abstract type whose possible types select different fields, selected without `__typename` (or with it under different keys), now fails generation, a custom scalar an operation selects now needs a schema (`scalarSchemas` or `zodScalars`), and a `*Query` or `*Fragment` type now clashes with typescript-operations' in one file. `operations: false` stops the results; 0.1.0's output needs `objects: false` and `operations: false` together.

### Patch Changes

- [#47](https://github.com/softistx/nxgt-graphql/pull/47) [`aad922c`](https://github.com/softistx/nxgt-graphql/commit/aad922c54ff091aca15dcfb45fe1693fab044588) Thanks [@SteveGT96](https://github.com/SteveGT96)! - The README's setup shows how to write the SDL files codegen reads (`nxgt-graphql-validation typedefs --out`, `nxgt-graphql-scalars typedefs --out`), the `schema` list that includes them, and how to run codegen.

## 0.1.0

### Minor Changes

- [#37](https://github.com/softistx/nxgt-graphql/pull/37) [`348a687`](https://github.com/softistx/nxgt-graphql/commit/348a687eb8734f9981b959a49ba8917bda2b5fb8) Thanks [@SteveGT96](https://github.com/SteveGT96)! - New package: a graphql-codegen plugin that writes Zod schemas and their types from your SDL. It covers every enum and input type, the arguments of each field, and the variables of each named operation in `documents`. Each schema carries the `@constraint` rules of `@nxgt/graphql-validation`, so a client refuses what the server refuses. A schema `withValidation` would refuse is refused with the same message. Schemas are named `zSignUpInput`, and types keep the typescript plugins' names (`SignUpInput`, `MutationSignUpArgs`, `SignUpMutationVariables`). Arguments and inputs are typed as the resolver receives them, variables as the client sends them, and defaults are optional on the way in and present on the way out. Custom scalars come from a `scalarSchemas` record (`@nxgt/graphql-scalars` from 0.4.0) or from one export each (`zodScalars`). A list takes a single value as `graphql` does, at any depth; an `ID` is a string. An input type in a cycle has its types written out (`Filter`, `FilterInput`). Recursive inputs use Zod getters, and `@oneOf` inputs become a union. graphql 16 and 17.

### Patch Changes

- Updated dependencies [[`bef8114`](https://github.com/softistx/nxgt-graphql/commit/bef8114b0d408559363b4d5ae57f5989eb7265be)]:
  - @nxgt/graphql-validation@0.2.0
