---
"@nxgt/graphql-validation": minor
---

Your own formats: `withValidation(schema, { formats })` takes a record of Zod string schemas (`z.string()` or a string format, never transformed) that `@constraint(format: "...")` may name beside the built-in ones. Their refusals carry `constraint: "format"` whatever their Zod code, and their own messages. A bad name, a built-in name (also a type error) or a schema that is not a string's is refused at startup, and so is wrapping a schema again with other formats. `checkConstraints` and `inputCode` from `./codegen` take the same record as an optional last parameter.
