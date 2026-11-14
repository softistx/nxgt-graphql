---
'@nxgt/graphql-validation': minor
---

Add `invalidInputOf(error, { translate? })`, which converts a `@constraint` `BAD_USER_INPUT` refusal (thrown directly or wrapped by graphql-js) into `invalidInputError`, with per-field codes from `FIELD_CODES` and the declared value as `params` under the argument's own key (`min`, `max`, `exclusiveMin`, `exclusiveMax`, `multipleOf`, `format`; none for `pattern`). An issue with no `constraint` is `validation.errors.invalid`; `originalError` is kept and any other error is returned as the same object.
