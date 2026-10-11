---
"@nxgt/graphql-codegen-zod": patch
---

A list too long is refused as `too_big` on the array, at the list's path, with zod 4.6.6 as with 4.6.5. A list that takes a single value is a union, and its size (`minItems`, `maxItems`) was checked inside each option: zod 4.6.6 stops an oversized array before its items and aborts that option, so the union reported `invalid_union` ("Invalid input") instead, and `@nxgt/graphql-codegen-msw` answered `validation.errors.invalid` instead of `validation.errors.too-many`. The size is now checked once on the union, `z.union([...]).check(z.maxLength(2))`, never `.max(2)` inside an option. Regenerate your files to get it.
