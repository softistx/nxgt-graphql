# Roadmap

What `@nxgt/graphql-codegen-msw` is heading for, phrased as what you get.

## Now

Nothing in progress.

## Next

Candidates, not commitments.

- **A `setupServer` that works under Bun**, once msw's own does, or a helper
  for the web `fetch` interceptor network the specs build today.

## Later

- **msw WebSocket subscriptions** (`graphql-transport-ws`), with a resolver
  that publishes rather than answers; SSE subscriptions are shipped.
- **Persisted queries**: matching a request that carries a hash and no query
  text (`documentId`, APQ).
- **Batched requests**: answering an array of operations posted at once.

## Not planned

- **Generator resolvers.** msw would answer from the iterator without calling
  the handler, so the variables of every request after the first would go
  unchecked. One handler per answer with `{ once: true }` does the same.

## Shipped

- **Subscription handlers** — `mock<Name>Subscription(execute)` streams a
  subscription sent with `Accept: text/event-stream` through
  `@nxgt/msw-graphql`'s executor, from the schema's `Subscription` resolvers.
- **The first release** — 0.1.0. One typed msw 3 handler per named query
  and mutation, its variables checked with `@nxgt/graphql-codegen-zod`'s
  schemas, a value the API cannot coerce answered as graphql-yoga answers it
  (every type named from the schema, graphql's suggestions included), and a
  constraint answered as one 400 error with a list of fields (the mapping of
  `@nxgt/graphql-validation`'s `fieldIssueOf`), as `BAD_USER_INPUT`, or by a
  function of yours.
