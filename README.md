# nxgt-graphql

GraphQL building blocks for applications built on the nxgt packages.

| Package | |
| --- | --- |
| [`@nxgt/graphql-scalars`](packages/graphql-scalars) | GraphQL scalars checked by Zod schemas, both ways: `DateTime`, `Date`, `EmailAddress`, `URL`, `UUID`, `NonEmptyString`, `PositiveInt`, and `zodScalar` for your own. graphql 16 and 17. Not yet published |
| [`@nxgt/graphql-validation`](packages/graphql-validation) | `@constraint` on arguments and input fields, checked by Zod schemas built from the directives, with one `BAD_USER_INPUT` error a form can map field by field. graphql 16 and 17. Not yet published |

## Develop

```sh
bun install
bun run build && bun run typecheck && bun run test
bunx biome ci
bun run verify:artifacts
```

[AGENTS.md](AGENTS.md) has the rules.
