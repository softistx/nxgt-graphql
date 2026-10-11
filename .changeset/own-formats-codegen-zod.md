---
"@nxgt/graphql-codegen-zod": minor
---

Your own formats: `formatSchemas: './formats'` names a module exporting the `formatSchemas` record that `withValidation(schema, { formats })` takes, and `zodFormats: { slug: './slug#slugSchema' }` one format, winning over the record. The plugin loads them and checks them, and every default against them, as `withValidation` does; a module it cannot load fails generation rather than being trusted. The generated file imports your schema and chains the other rules on it (`formatSchemas.slug.max(40)`), so the client refuses what the server refuses, with the same message; the built-in formats stay inline. Requires `@nxgt/graphql-validation` 0.3.
