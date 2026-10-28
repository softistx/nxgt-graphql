# @nxgt/graphql-client

A typed GraphQL client for the documents the graphql-codegen client preset
writes (`TypedDocumentNode`, or `TypedDocumentString`), built on
[`@nxgt/httpyz`](https://www.npmjs.com/package/@nxgt/httpyz): the variables you
pass and the data you get back are typed from the document, and every failure
is a typed error.

## Install

```sh
bun add @nxgt/graphql-client graphql typescript
```

Peers, both **required**:

| Peer | Range |
| --- | --- |
| `graphql` | `^16.11.0 \|\| ^17.0.0` |
| `typescript` | `^6.0.3 \|\| ^7.0.0` |

`@nxgt/httpyz` is a dependency; you import its types from it only when you
pass your own client.

For the React hooks (`@nxgt/graphql-client/react`), two **optional** peers:

```sh
bun add react
bun add -d @types/react
```

| Optional peer | Range | Needed for |
| --- | --- | --- |
| `react` | `^19.0.0` | `@nxgt/graphql-client/react` |
| `@types/react` | `^19.0.0` | its types |

The root entry never imports `react`: a server or a script that uses the
client alone installs neither.

## Setup

The client takes the documents graphql-codegen's client preset writes:
install `@graphql-codegen/cli` and `@graphql-codegen/client-preset`.

```sh
bun add -d @graphql-codegen/cli @graphql-codegen/client-preset
```

Either document mode works:

```ts
// codegen.ts
const config = {
  generates: {
    'src/gql/': {
      preset: 'client',
      // presetConfig: { documentMode: 'string' } to get TypedDocumentString
    },
  },
};
```

`documentMode: 'documentNode'` (the default) writes `TypedDocumentNode`s;
`documentMode: 'string'` writes `TypedDocumentString`s, sent as written.
`persistedDocuments` (in `presetConfig`, for
[persisted queries](docs/guide/client.md#persisted-queries)) and
`documentTransforms` (with its `addTypenameSelectionDocumentTransform`, for a
[cache with `documentId`](docs/guide/cache.md#__typename)) are the client
preset's options, set in this same `codegen.ts`.

## Subpaths

| Subpath | What it holds |
| --- | --- |
| `@nxgt/graphql-client` | the client, its errors and the normalized cache |
| `@nxgt/graphql-client/react` | `GraphQLProvider`, `useClient`, `useQuery`, `useMutation`, `useSubscription`, `useFragment` (React 19) |

## Usage

### Create a client, run a query

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';
import { graphql } from './gql';

const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  headers: { 'x-client': 'web' },
  timeout: 10_000,
});

const UserQuery = graphql(`
  query User($id: ID!) {
    user(id: $id) { id name }
  }
`);

const { user } = await client.query(UserQuery, { id: '42' });
```

`mutate` is the same for a mutation. Variables are optional when the operation
requires none. Forwarding documents you do not choose? `execute` runs a query
or a mutation, whichever the document holds:

```ts
const data = await client.execute(document, variables); // query() or mutate(), same errors
```

See [Client](docs/guide/client.md) and [Execute](docs/guide/client.md#execute).

Already have an `@nxgt/httpyz` client (its auth, middleware, base URL)? Pass
it instead of `url`:

```ts
import { createHttpClient } from '@nxgt/httpyz';

const http = createHttpClient({ baseUrl: 'https://api.example.com' });
const client = createGraphQLClient({ http, path: '/graphql' }); // path defaults to /graphql
```

See [Over an existing httpyz client](docs/guide/client.md#over-an-existing-httpyz-client).

### Handle the errors

```ts
import { ApiStatusError, ApiUnavailableError, isApiError } from '@nxgt/graphql-client';

try {
  await client.query(UserQuery, { id: '42' });
} catch (error) {
  if (isApiError(error)) console.log(error.code, error.status, error.fields);
  else if (error instanceof ApiStatusError) console.log(error.status, error.statusText);
  else if (error instanceof ApiUnavailableError) console.log(error.reason);
  else throw error;
}
```

An `ApiError`'s `status` is always a failure status: `extensions.http.status`,
else the HTTP status when it is 400 or above, else 400; `httpStatus` keeps
the HTTP status as it came. Type the extensions your API sends by declaration
merging:

```ts
declare module '@nxgt/graphql-client' {
  interface ApiErrorExtensions {
    field?: string; // error.extensions.field: string | undefined
  }
}
```

See [Errors](docs/guide/errors.md).

### Subscribe over server-sent events

```ts
import { graphql } from './gql';

const OnMessage = graphql(`
  subscription OnMessage($room: ID!) {
    message(room: $room) { id text }
  }
`);

const controller = new AbortController();
for await (const { message } of client.subscribe(
  OnMessage,
  { room: 'r1' },
  { signal: controller.signal },
)) {
  console.log(message.text);
}
```

`subscribe(document, variables?, options?)` returns a `Subscription<TResult>`:
an `AsyncIterable` read once with `for await`, with a `close()` method. Its
`SubscribeOptions` are `signal` (ends it: the loop rejects with the signal's
reason), `headers` (over the client's, for this subscription) and `onOpen`
(called when the server accepted the stream, before any event: a quiet stream
is known to be open); it takes no `retry` nor `timeout`.

```ts
const messages = client.subscribe(OnMessage, { room: 'r1' }, {
  onOpen: () => setStatus('live'),
});
```

The server must speak the GraphQL over SSE protocol's distinct connections
mode: graphql-yoga does out of the box; elsewhere, mount
[graphql-sse](https://github.com/enisdenjo/graphql-sse)'s handler. It connects
when the loop starts, and the connection closes on `complete`, `close()`,
`break`, an error or an abort. See [Subscriptions](docs/guide/subscriptions.md).

### Persisted queries and batching

Both are off by default, and both need the server set up for them.

```ts
const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  // { mode: 'documentId' }: the client preset's persistedDocuments hash
  // (graphql-yoga's usePersistedOperations, with extractPersistedOperationId
  // reading documentId: the client sends the GraphQL-over-HTTP documentId
  // field, which the plugin ignores by default); { mode: 'apq' }: Automatic
  // Persisted Queries, registered on first use (an APQ plugin).
  persisted: { mode: 'apq' },
  // Queries issued together posted as one array (graphql-yoga's batching:
  // true); max must not exceed the server's limit (10 with batching: true).
  batch: { max: 10, wait: 0 },
});
```

| Option | Default | Effect |
| --- | --- | --- |
| `persisted` | `false` | `{ mode: 'documentId' }` sends `documentId` with no text; `{ mode: 'apq' }` sends the text's SHA-256, and the text once when the server does not hold it |
| `batch` | `false` | `{ max?: 10, wait?: 0 }`: queries with the same per-call options share one request; a mutation is sent alone |

See [Persisted queries](docs/guide/client.md#persisted-queries) and
[Batching](docs/guide/client.md#batching).

### Normalized cache (browser)

```ts
import { createGraphQLClient, normalizedCache } from '@nxgt/graphql-client';

const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  // possibleTypes: graphql-codegen's fragment-matcher output, for fragments
  // on interfaces and unions; keys: an identity other than id or _id;
  // onError: where a watch's error goes (default console.error).
  cache: normalizedCache({
    possibleTypes,
    keys: { Book: (b) => String(b.isbn) },
    onError: (error) => logger.error(error),
  }),
});

await client.query(BookQuery, { id: '1' });                                // network, written
await client.query(BookQuery, { id: '1' });                                // cache, no request
await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'network-only' }); // network, written
await client.mutate(RenameBook, { id: '1', title: 'Dune' });              // updates Book:1

// Created with a cache, client.cache is a GraphQLCache: no `!`.
const stop = client.cache.watch(BookQuery, { id: '1' }, (data) => render(data));
const card = client.cache.readFragment(BookCard, 'Book:1');             // one entity, by a fragment
client.cache.evict({ __typename: 'Book', id: '1' });
```

Off by default: entities stored once by `__typename` and `id`, `fetchPolicy`
per query, and `client.cache` to read, write and watch them. A client created
without `cache` has `client.cache` typed `undefined`. See [Normalized cache](docs/guide/cache.md).

### React

```tsx
import { createGraphQLClient, normalizedCache } from '@nxgt/graphql-client';
import {
  GraphQLProvider,
  useFragment,
  useMutation,
  useQuery,
  useSubscription,
} from '@nxgt/graphql-client/react';

const client = createGraphQLClient({ url: '/graphql', cache: normalizedCache() });
// <GraphQLProvider client={client}><App /></GraphQLProvider>

function Book({ id }: { id: string }) {
  const { data, error, loading, refetch } = useQuery(BookQuery, { id });
  const [rename, { loading: saving }] = useMutation(RenameBook);
  const { data: live } = useSubscription(OnBookChanged, { id });
  const card = useFragment(BookCard, { __typename: 'Book', id });
  if (loading) return <Spinner />;
  if (error) return <Failure error={error} retry={() => refetch().catch(() => {})} />;
  return <Title book={data!.book} onRename={(title) => rename({ id, title })} />;
}
```

Every hook sends from an effect, never during a render, so a server render
sends nothing, and each aborts or closes what it started on unmount.
`useSubscription` also takes `onOpen`, called once the stream is accepted:

```tsx
useSubscription(OnBookChanged, { id }, { onOpen: () => setStatus('live') });
```

See [React](docs/guide/react.md).

## Traps

- **Never share a client between users on a server.** Headers carry the user's
  token; create one client per incoming request.
- **Keep `cache` off on a server.** One client serves one request there, so a
  cache would hold one user's data for one request and nothing more. The
  client does not enforce it.
- **With a cache and `persisted: { mode: 'documentId' }`, the documents must
  carry `__typename`**: add the client preset's
  `addTypenameSelectionDocumentTransform`, or the call throws a `TypeError`
  before anything is sent. `apq` needs nothing.
- **A subscription's results are not written to the cache.**
- **`onUnauthenticated` may be async, and runs once per caller.** Keep its side
  effects idempotent; a GraphQL-level 401 on an HTTP 200 gets no refresh (see
  [Errors](docs/guide/errors.md#onunauthenticated)).
- **A mutation is never retried**, and `query()` refuses a mutation document
  (and `mutate()` a query) with a `TypeError`; `execute()` takes either and
  refuses a subscription. The one second post of a
  mutation is APQ's registration, after the server answered
  `PersistedQueryNotFound` without running it.
- **A subscription is never retried, reconnected, deduplicated or batched.**
  A dropped connection rejects the loop with
  `ApiUnavailableError('unreachable')`; subscribe again to resume. `subscribe()`
  refuses a query or a mutation with a `TypeError`, and a subscription is read
  once.
- **An `ApiError` on HTTP 200 reads `status` 400** when no
  `extensions.http.status` names one (since 0.2.0); `httpStatus` is the 200.
- **A subscription refused with an error status's event stream rejects with
  the `ApiError` its `next` event carries** (since 0.4.0), as a refused JSON
  body does: graphql-yoga answers so for a missing or mistyped variable (400),
  an error with `extensions.http.status` thrown before the subscription starts,
  and APQ's `PersistedQueryNotFound` (404), which the client then resends with
  the text, so `useAPQ()` needs no `forceStatusCodeOk`. A stream with no GraphQL
  errors stays an `ApiStatusError`, its raw text as `body`.
- **`documentId` mode needs the client preset's `persistedDocuments`**: a
  document without its hash throws a `TypeError` before anything is sent.
- **Identical in-flight queries share one request.** Pass `dedupe: false` to
  turn it off.
- **Every React hook needs a `GraphQLProvider` above it**, and `useFragment`
  a client with a cache: each throws otherwise, naming the fix.
- **No Suspense yet**: `useQuery` returns `loading`, it does not suspend.
- **The client preset's fragment masking may write its own `useFragment`**
  (its unmask function, in `gql/fragment-masking.ts`). Ours reads the cache by
  an entity reference; import one of them under another name, or rename the
  preset's with `fragmentMasking: { unmaskFunctionName }`.

## Documentation

- [Guide index](docs/README.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
