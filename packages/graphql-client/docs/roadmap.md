# Roadmap

What `@nxgt/graphql-client` is heading for, phrased as what you get.

## Now

Nothing in progress.

## Next

Candidates, not commitments.

- **A GraphQL-level 401 refreshed and replayed.** A GraphQL error carrying
  `extensions.http.status` 401 on an HTTP 200 would go through
  `@nxgt/httpyz`'s `auth.refresh` and be replayed once, as an HTTP 401 is.
- **A subscription resumed after a dropped connection.** Today the loop
  rejects with `ApiUnavailableError('unreachable')` and subscribing again is
  the application's to do; the client would reconnect and resume instead,
  calling `onOpen` again on each new connection.
- **Suspense for `useQuery`.** A query that suspends the component until its
  first answer, for a `<Suspense>` boundary and streaming server rendering,
  instead of returning `loading`.
- **A subscription's results written to the cache**, as an option, so a live
  update reaches every query showing the same entity.

## Later

- **Garbage collection.** Entities no result refers to any more removed,
  instead of staying until evicted or reset.
- **Field policies, pagination included.** A list merged with the next page
  instead of replaced, and a field read through a function of its own.
- **Structural sharing.** A read that changed nothing returning the same
  objects, so a UI binding can skip a render.
- **Vue bindings.**
- **Subscriptions over WebSocket.**

## Shipped

In the next minor.

- **`subscribe` takes `onOpen`: know a quiet stream is open.** It is called
  once the server accepted the connection, before any event.
  `useSubscription` takes `onOpen` too (#132).

Released in 0.4.0.

- **A GraphQL error carried by an error status's event stream read as an
  `ApiError`.** A subscription graphql-yoga refuses before it starts (a
  missing or mistyped variable, an error with `extensions.http.status`, APQ's
  `PersistedQueryNotFound`) rejects with the `ApiError` of the stream's
  `next` event, as a refused JSON body does, instead of an `ApiStatusError`
  holding the stream's raw text. APQ subscriptions on graphql-yoga work with
  `useAPQ()`'s defaults, without `forceStatusCodeOk`.

Released in 0.3.x.

- **Timeouts and dropped connections named by `@nxgt/httpyz` 0.4.** A timeout
  while the reply body is read carries httpyz's `TimeoutError` as its
  `cause`, and a body cut off mid-read is `ApiUnavailableError('unreachable')`
  instead of the runtime's raw `TypeError`. The client's options are typed
  under `moduleResolution: nodenext` too.

Released in 0.2.0.

- **A failure status on every `ApiError`.** `status` is
  `extensions.http.status`, else the HTTP status when it fails, else 400: a
  refusal sent on HTTP 200 reads 400, and `httpStatus` keeps the 200.
  `ApiStatusError` keeps the response's `statusText`.
- **Error extensions typed by the application.** `ApiErrorExtensions` is an
  interface: declare the keys your API sends once, and
  `error.extensions.field` is typed.
- **`execute`.** One call for a query or a mutation, chosen from the
  document, with `query`'s and `mutate`'s errors: for code that forwards any
  document.
- **`client.cache` typed from the options.** A client created with a cache
  reads `client.cache` without a `!`; one created without has it `undefined`.

Released in 0.1.0.

- **The core client**. `query` and `mutate`
  typed from a `TypedDocumentNode` or `TypedDocumentString`, typed errors, an
  unauthenticated hook, query retries, and deduplication of identical in-flight
  requests.
- **Persisted queries**. Operations sent by
  the client preset's `persistedDocuments` hash (`documentId`), or by
  Automatic Persisted Queries (`apq`), registered on first use.
- **Batching**. Queries issued together
  posted as one JSON array, each with its own result, error and signal.
- **Subscriptions over SSE**. `subscribe`
  yields each result over server-sent events (the GraphQL over SSE protocol's
  distinct connections mode, as graphql-yoga serves it), closed on every way
  out of the loop. No reconnection yet.
- **A normalized cache**. `normalizedCache({
  possibleTypes, keys })` for the browser: entities stored once, `cache-first`
  queries answered without a request, mutations' entities written back,
  `fetchPolicy`, and `client.cache`'s `read`, `write`, `watch`,
  `readFragment`, `watchFragment`, `evict`, `modify` and `reset`. Off by
  default.
- **React bindings**.
  `@nxgt/graphql-client/react` for React 19: `GraphQLProvider`, `useClient`,
  `useQuery` (variables compared by value, aborted on unmount, kept current
  by the cache's `watch`), `useMutation`, `useSubscription` and `useFragment`
  (over `watchFragment`). Nothing is sent during a render, so a server render
  sends nothing. `react` is an optional peer; the root entry never imports
  it.
