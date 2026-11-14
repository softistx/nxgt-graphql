---
'@nxgt/graphql-validation': minor
---

Add `constraintInvalidInput(error, { translate? })`, which converts a `@constraint` `BAD_USER_INPUT` refusal (thrown directly or wrapped by graphql-js) into `invalidInputError`, with per-field codes from `FIELD_CODES` and the declared bound as `params` (`{ min }` or `{ max }`). An issue with no `constraint` falls back to `validation.errors.invalid`; `originalError` is kept.
