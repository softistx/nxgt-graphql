---
"@nxgt/graphql-codegen-zod": patch
---

A list that also takes a single value now refuses what the server refuses, with zod 4.6.5 as with 4.6.6. Its union only gives the value its shape, a list as sent or a single value wrapped, and parses nothing; the list's own schema, the server's (`z.array(item).max(n)`), comes after it in `.pipe(...)` and parses the items once. Before, the size check sat inside each option: zod 4.6.6 stops an oversized array before its items and aborts that option, so the union reported `invalid_union` ("Invalid input") instead of the list too long, and `@nxgt/graphql-codegen-msw` answered `validation.errors.invalid` instead of `validation.errors.too-many`. A wrong-typed item, or a single value of the wrong type, is now refused at its own path (`[i]`, or `[0]` for a single value) instead of `Invalid input` at the list's path, as the server does. The input and output types are unchanged. Regenerate your files to get it.
