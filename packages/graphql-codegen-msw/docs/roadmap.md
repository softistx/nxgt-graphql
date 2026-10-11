# Roadmap

What `@nxgt/graphql-codegen-msw` is heading for, phrased as what you get.

## Now

- **The first release, 0.1.0** (in progress, not released yet). One typed
  msw 3 handler per named query and mutation, its variables checked with
  `@nxgt/graphql-codegen-zod`'s schemas, a value the API cannot coerce
  answered as graphql-yoga answers it, and a constraint answered as one 400
  error with a list of fields, as `BAD_USER_INPUT`, or by a function of
  yours.

## Next

Candidates, not commitments.

- **A `setupServer` that works under Bun**, once msw's own does, or a helper
  for the web `fetch` interceptor network the specs build today.
- **Every type named in a coercion refusal.** Inside an input object the
  mock leaves the type's name out (`Expected value to include required field
  "firstName"`) and writes no `Did you mean …?`; the generated file could
  carry the input types its operations reach, so each message reads exactly
  as the API's.

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

Nothing yet.
