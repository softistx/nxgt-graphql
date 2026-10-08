# Roadmap

What `@nxgt/graphql-codegen-zod` is heading for, phrased as what you get.

## Now

- **The first release, 0.1.0.** Zod 4 schemas and types for enums, input
  types, field arguments and operation variables, carrying every
  `@constraint` of `@nxgt/graphql-validation`, so the client refuses what the
  server refuses.

## Next

Candidates, not commitments.

- **Emit only some parts**, an option to write just the arguments, or just
  the variables, of a file.
- **Variables as lenient as `graphql`** (an `Int` for an `ID`, a single
  value for a list), if a client needs to send them. Today the client is
  stricter on these two coercions only.
- **Your own formats**, once `@nxgt/graphql-validation` supports custom
  `@constraint(format: "...")` values; the plugin will carry them.

## Later

Nothing yet.

## Not planned

- **Zod 3.** The schemas use Zod 4's getters, `prefault`, `z.strictObject` and
  `z.email()`; they have no Zod 3 form.

## Shipped

Nothing yet.
