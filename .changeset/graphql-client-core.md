---
'@nxgt/graphql-client': minor
---

First release: `createGraphQLClient` over `@nxgt/httpyz`, with `query` and `mutate` on the client preset's documents, typed errors (`ApiError`, `ApiStatusError`, `ApiUnavailableError`, `isApiError`), an `onUnauthenticated` hook, query retries (never a mutation) and identical queries in flight shared.
