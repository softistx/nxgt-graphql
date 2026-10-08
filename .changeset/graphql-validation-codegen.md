---
"@nxgt/graphql-validation": minor
---

New subpath `@nxgt/graphql-validation/codegen` for code generators such as the coming `@nxgt/graphql-codegen-zod`. `inputCode(type, constraints, where, named)` writes the schema of an argument or input field as source. It applies the same rules as `withValidation`, and a constraint that cannot apply is refused with the same message as at startup. It comes with `constraintsOn` and the `Constraint` type, and with `checkConstraints(schema)`, which runs every startup check of `withValidation` without wrapping anything, so a generator refuses the same schemas. Servers keep using the main entry.
