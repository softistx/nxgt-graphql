---
"@nxgt/graphql-scalars": minor
"@nxgt/graphql-codegen-msw": minor
---

An input a `zodScalar` refuses now carries `extensions: { code: 'INVALID_SCALAR', scalar, reason }` (type `InvalidScalarExtensions`, `reason` being Zod's first issue code), on a variable's error too, so a server maps it without parsing the message; `@nxgt/graphql-codegen-msw` gives a custom scalar's coercion refusal the same extensions.
