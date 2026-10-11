# Roadmap

What `@nxgt/graphql-codegen-zod` is heading for, phrased as what you get.

## Now

- **Your own formats** (in progress, not released yet). `formatSchemas:
  './formats'` reads the record `withValidation(schema, { formats })` takes,
  `zodFormats` one format; the generated schemas import your formats and
  chain the other rules on them, so the client refuses what the server
  refuses. Needs `@nxgt/graphql-validation` 0.3.

## Next

Candidates, not commitments.

- **Emit only some parts**, an option to write just the arguments, or just
  the variables, of a file.

## Later

Nothing yet.

## Not planned

- **An `Int` for an `ID` on the client.** An id is a string in what the
  client sends, as in what the resolver receives.

- **Zod 3.** The schemas use Zod 4's getters, `prefault`, `z.strictObject` and
  `z.email()`; they have no Zod 3 form.

## Shipped

- **Declarations that resolve under `nodenext`, 0.2.1.** The generated
  file's `scalarSchemas` import typechecks with `moduleResolution`
  `nodenext` or `node16`, with `@nxgt/graphql-scalars` 0.4.1 or later.
- **Output types, 0.2.0.** Zod schemas and types for the SDL's object types,
  interfaces and unions, and for each named operation's result and each
  fragment, with `__typename` discriminating abstract types; `objects: false`
  or `operations: false` turns either part off.
- **The first release, 0.1.0.** Zod 4 schemas and types for enums, input
  types, field arguments and operation variables, carrying every
  `@constraint` of `@nxgt/graphql-validation`, so the client refuses what the
  server refuses.
