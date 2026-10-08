---
"@nxgt/graphql-validation": minor
---

New subpath `@nxgt/graphql-validation/codegen` for code generators, read by the new `@nxgt/graphql-codegen-zod`. `inputCode(type, constraints, where, named, options?)` writes the schema of an argument or input field as source; `options.list` lets a generator rewrite each list, for example to take a single value as graphql does. It applies the same rules as `withValidation`, and a constraint that cannot apply is refused with the same message as at startup. It comes with `constraintsOn` and the `Constraint` type, and with `checkConstraints(schema)`, which runs every startup check of `withValidation` without wrapping anything, so a generator refuses the same schemas. Servers keep using the main entry.
