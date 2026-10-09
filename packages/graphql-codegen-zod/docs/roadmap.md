# Roadmap

What `@nxgt/graphql-codegen-zod` is heading for, phrased as what you get.

## Now

- **Output types.** Zod schemas and types for the SDL's object types,
  interfaces and unions (written), then for each named operation's result
  and each fragment, with `__typename` discriminating abstract types.

## Next

Candidates, not commitments.

- **Emit only some parts**, an option to write just the arguments, or just
  the variables, of a file.
- **Your own formats**, once `@nxgt/graphql-validation` supports custom
  `@constraint(format: "...")` values; the plugin will carry them.

## Later

Nothing yet.

## Not planned

- **An `Int` for an `ID` on the client.** An id is a string in what the
  client sends, as in what the resolver receives.

- **Zod 3.** The schemas use Zod 4's getters, `prefault`, `z.strictObject` and
  `z.email()`; they have no Zod 3 form.

## Shipped

- **The first release, 0.1.0.** Zod 4 schemas and types for enums, input
  types, field arguments and operation variables, carrying every
  `@constraint` of `@nxgt/graphql-validation`, so the client refuses what the
  server refuses.
