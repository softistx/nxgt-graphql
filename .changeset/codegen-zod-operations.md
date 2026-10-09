---
"@nxgt/graphql-codegen-zod": minor
---

The plugin now writes each named operation's result and each fragment: `zSearchQuery` and `SearchQuery`, `zUserFieldsFragment` and `UserFieldsFragment`, typed as what the response holds (custom scalars decoded, unknown fields dropped, a fragment spread inlined). A selection on an interface or union is a `z.discriminatedUnion` on `__typename`; a field under `@skip`, `@include` or `@defer` is optional. A deep selection is declared apart, so TypeScript infers an operation of any depth.

On by default, which can break a config that generated with the last release: an abstract type whose possible types select different fields, selected without `__typename` (or with it under different keys), now fails generation, a custom scalar an operation selects now needs a schema (`scalarSchemas` or `zodScalars`), and a `*Query` or `*Fragment` type now clashes with typescript-operations' in one file. `operations: false` stops the results; 0.1.0's output needs `objects: false` and `operations: false` together.
