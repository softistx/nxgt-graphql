---
"@nxgt/graphql-validation": minor
---

Each issue a `@constraint` raises in `extensions.issues` now carries `value`, the value that argument was declared with (`100` for `maxLength: 100`, `"email"` for `format: "email"`), so a client can say "at most 100 characters" without parsing the message; an issue from `validated()` has neither `constraint` nor `value`.
