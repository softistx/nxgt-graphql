---
'@nxgt/graphql-client': minor
---

First release: `createGraphQLClient` over `@nxgt/httpyz`, with `query` and `mutate` on the client preset's documents (`TypedDocumentNode` or `TypedDocumentString`), typed errors (`ApiError`, `ApiStatusError`, `ApiUnavailableError`, `isApiError`), an awaitable `onUnauthenticated` hook, query retries (never a mutation), identical queries in flight shared, persisted queries (`persisted: { mode: 'documentId' }` for the client preset's `persistedDocuments` hashes, or `{ mode: 'apq' }` for Automatic Persisted Queries) and query batching (`batch: { max, wait }`, graphql-yoga's array batching).
