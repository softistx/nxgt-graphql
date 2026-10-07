# nxgt-graphql

GraphQL building blocks for applications built on the nxgt packages.

| Package | |
| --- | --- |
| [`@nxgt/graphql-scalars`](packages/graphql-scalars) | GraphQL scalars checked by Zod schemas, both ways: `DateTime`, `Date`, `EmailAddress`, `URL`, `UUID`, `NonEmptyString`, `PositiveInt`, and `zodScalar` for your own. graphql 16 and 17. Not yet published |

## Develop

```sh
bun install
bun run build && bun run typecheck && bun run test
bunx biome ci
bun run verify:artifacts
```

[AGENTS.md](AGENTS.md) has the rules.
