# Roadmap

What `@nxgt/graphql-codegen-msw` is heading for, phrased as what you get.

## Now

Nothing in progress.

## Next

Candidates, not commitments.

- **A `setupServer` that works under Bun**, once msw's own does, or a helper
  for the web `fetch` interceptor network the specs build today.

## Later

- **Subscriptions.** msw 3 mocks them over WebSocket (`graphql-transport-ws`)
  only, with a resolver that publishes rather than answers, and an invalid
  input has no HTTP status there. `@nxgt/graphql-client` subscribes over SSE,
  which msw's GraphQL subscription handler does not intercept.
- **Persisted queries**: matching a request that carries a hash and no query
  text (`documentId`, APQ).
- **Batched requests**: answering an array of operations posted at once.

## Not planned

- **Generator resolvers.** msw would answer from the iterator without calling
  the handler, so the variables of every request after the first would go
  unchecked. One handler per answer with `{ once: true }` does the same.

## Shipped

- **The first release** — 0.1.0. One typed msw 3 handler per named query
  and mutation, its variables checked with `@nxgt/graphql-codegen-zod`'s
  schemas, a value the API cannot coerce answered as graphql-yoga answers it
  (every type named from the schema, graphql's suggestions included), and a
  constraint answered as one 400 error with a list of fields (the mapping of
  `@nxgt/graphql-validation`'s `fieldIssueOf`), as `BAD_USER_INPUT`, or by a
  function of yours.
