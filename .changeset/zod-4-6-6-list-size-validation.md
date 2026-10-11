---
"@nxgt/graphql-validation": patch
---

Docs: from zod 4.6.6, a list longer than `maxItems` is refused with one `too_big` issue at the list's path and none for its items, since zod stops an oversized array before parsing them.
