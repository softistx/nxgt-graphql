# @nxgt/graphql-client

A typed GraphQL client for the documents the graphql-codegen client preset
writes (`TypedDocumentNode`, or `TypedDocumentString`), built on
[`@nxgt/httpyz`](https://www.npmjs.com/package/@nxgt/httpyz): the variables you
pass and the data you get back are typed from the document, and every failure
is a typed error.

> Not published yet.

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

## Setup

The client takes the documents the client preset writes. Either mode works:

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

## Subpaths

Only `.` is exported.

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
requires none. See [Client](docs/guide/client.md).

### Handle the errors

```ts
import { ApiUnavailableError, isApiError } from '@nxgt/graphql-client';

try {
  await client.query(UserQuery, { id: '42' });
} catch (error) {
  if (isApiError(error)) console.log(error.code, error.fields);
  else if (error instanceof ApiUnavailableError) console.log(error.reason);
  else throw error;
}
```

See [Errors](docs/guide/errors.md).

### Subscribe over server-sent events

```ts
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

## Traps

- **Never share a client between users on a server.** Headers carry the user's
  token; create one client per incoming request.
- **`onUnauthenticated` may be async, and runs once per caller.** Keep its side
  effects idempotent; a GraphQL-level 401 on an HTTP 200 gets no refresh (see
  [Errors](docs/guide/errors.md#onunauthenticated)).
- **A mutation is never retried**, and `query()` refuses a mutation document
  (and `mutate()` a query) with a `TypeError`. The one second post of a
  mutation is APQ's registration, after the server answered
  `PersistedQueryNotFound` without running it.
- **A subscription is never retried, reconnected, deduplicated or batched.**
  A dropped connection rejects the loop with
  `ApiUnavailableError('unreachable')`; subscribe again to resume. `subscribe()`
  refuses a query or a mutation with a `TypeError`, and a subscription is read
  once.
- **`documentId` mode needs the client preset's `persistedDocuments`**: a
  document without its hash throws a `TypeError` before anything is sent.
- **Identical in-flight queries share one request.** Pass `dedupe: false` to
  turn it off.

## Documentation

- [Guide index](docs/README.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
