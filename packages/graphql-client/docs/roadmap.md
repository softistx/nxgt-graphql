# Roadmap

What `@nxgt/graphql-client` is heading for, phrased as what you get.

## Now

- **The core client** (this effort, not released yet). `query` and `mutate`
  typed from a `TypedDocumentNode` or `TypedDocumentString`, typed errors, an
  unauthenticated hook, query retries, and deduplication of identical in-flight
  requests.
- **Persisted queries** (this effort, not released yet). Operations sent by
  the client preset's `persistedDocuments` hash (`documentId`), or by
  Automatic Persisted Queries (`apq`), registered on first use.
- **Batching** (this effort, not released yet). Queries issued together
  posted as one JSON array, each with its own result, error and signal.

## Next

Candidates, not commitments.

- **A GraphQL-level 401 refreshed and replayed.** A GraphQL error carrying
  `extensions.http.status` 401 on an HTTP 200 would go through
  `@nxgt/httpyz`'s `auth.refresh` and be replayed once, as an HTTP 401 is.
- **Subscriptions over SSE.**
- **A normalized cache.**
- **React bindings.**

## Later

- **Vue bindings.**
- **Subscriptions over WebSocket.**
