# @nxgt/graphql-validation documentation

## Guides

| Page | Read it when |
| --- | --- |
| [Constraints](guide/constraints.md) | you write `@constraint` in your schema: setup with `withValidation`, every argument and its Zod equivalent, the formats and your own, lists and nested inputs |
| [Answering invalid input as one error](guide/invalid-input.md) | your API answers invalid input as one 400 error with a list of fields (`invalidInputError`, `fieldIssueOf` for a Zod parse), or a refusal such as a 409 names the fields at fault (`fieldsError`) |
| [Limiting the depth and cost of a query](guide/query-limits.md) | a schema has list cycles and you want to refuse a query nested too deep, too costly or too wide (`maxDepth`, `maxListCost`, `maxFields`), with graphql-js `validate` or graphql-yoga |
| [Errors](guide/errors.md) | you handle the `BAD_USER_INPUT` error in a client, build it yourself with `badUserInput`, or add rules a directive cannot say with `validated` |

## Reference

| Page | Read it when |
| --- | --- |
| [Troubleshooting](troubleshooting.md) | you have an error message and want its cause |
| [Roadmap](roadmap.md) | you want to know what is coming, and what is not |
