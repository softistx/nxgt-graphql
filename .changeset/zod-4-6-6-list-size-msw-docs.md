---
"@nxgt/graphql-codegen-msw": patch
---

Docs: a known difference with graphql-yoga. From zod 4.6.6, a list of a custom scalar longer than `maxItems` is answered `too-many` even when an item is one the scalar refuses, since zod stops an oversized array before its items; graphql-yoga answers the scalar's coercion error.
