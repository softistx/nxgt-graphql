# Subscriptions

`client.subscribe` runs a subscription over server-sent events and yields each
result's `data`, typed from the document.

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';
import { graphql } from './gql';

const client = createGraphQLClient({ url: 'https://api.example.com/graphql' });

const OnMessage = graphql(`
  subscription OnMessage($room: ID!) {
    message(room: $room) { id text }
  }
`);

for await (const { message } of client.subscribe(OnMessage, { room: 'r1' })) {
  console.log(message.text);
}
```

## The server

The client speaks the
[GraphQL over SSE](https://github.com/enisdenjo/graphql-sse/blob/master/PROTOCOL.md)
protocol's **distinct connections mode**: one HTTP connection per
subscription. It posts the operation to the GraphQL endpoint with
`accept: text/event-stream`, and reads a `next` event per result and a
`complete` event at the end.

- **graphql-yoga** serves it out of the box: a subscription posted with that
  `accept` header is answered as an event stream. Nothing to set up.
- **Other servers**: mount
  [graphql-sse](https://github.com/enisdenjo/graphql-sse)'s handler on the
  GraphQL path, or point an httpyz client's `baseUrl` and `path` at the route
  that serves it.

```ts
// graphql-sse on another route: over an httpyz client of your own.
import { createHttpClient } from '@nxgt/httpyz';

const sse = createGraphQLClient({
  http: createHttpClient({ baseUrl: 'https://api.example.com' }),
  path: '/graphql/stream',
});
```

The single connection mode (one connection carrying several subscriptions,
with a reservation token) is not supported.

## Reading it

`subscribe(document, variables?, options?)` returns a `Subscription<TResult>`:
an `AsyncIterable<TResult>` with a `close()` method.

| Option | Effect |
| --- | --- |
| `signal` | Ends the subscription: the loop rejects with the signal's reason |
| `headers` | Over the client's headers, for this subscription |

`SubscribeOptions` takes no `retry` nor `timeout`. The request always asks for
`accept: text/event-stream`, whatever `accept` the client's headers set; only
the subscription's own `headers` can change it.

- **It connects when the loop starts**, not when `subscribe` is called. Create
  it, hand it around, and the request leaves on the first iteration.
- **It is read once.** A second `for await` over the same subscription throws
  `TypeError: A subscription is read once`; call `subscribe` again instead.
- **`subscribe` refuses a query or a mutation** with a `TypeError`, at once and
  before anything is sent; `query` and `mutate` refuse a subscription.
- **Variables are typed** as for a query: required when the operation requires
  some, an extra key refused.

## How it ends

The connection is closed on every way out of the loop:

| What happens | The loop |
| --- | --- |
| the server sends `complete` | ends |
| the server ends the stream without `complete` | ends |
| `subscription.close()`, from anywhere | ends |
| `break`, `return` or a `throw` inside the loop | ends |
| the `signal` aborts | rejects with the signal's reason |
| a `next` event carries `errors` | rejects with an `ApiError` |
| the connection fails or drops | rejects (see below) |

```ts
const messages = client.subscribe(OnMessage, { room: 'r1' });
setTimeout(() => messages.close(), 60_000);

for await (const { message } of messages) {
  if (message.text === 'bye') break; // closes the connection too
}
```

Events other than `next` and `complete`, and the server's keep-alive comments,
are ignored.

## Errors

Every failure is one of the errors queries throw (see [Errors](errors.md)):

- **A `next` carrying `errors`** throws an `ApiError`, with the event's `data`
  on `error.data`, and ends the subscription. Partial data is never yielded
  silently, as for a query.
- **A refused connection** (a non-2xx) throws the `ApiError` its JSON body
  carries, else an `ApiStatusError` with its `status` and its body (text, or
  JSON when labelled so). A server that answers an error status with an event
  stream (graphql-yoga does, for an error carrying `extensions.http.status`
  thrown before the subscription starts, and for APQ's `PersistedQueryNotFound`)
  gives an `ApiStatusError` with that status, never an `ApiError`: the client
  does not parse an error status's event stream yet, so `body` is the stream's
  raw text (`event: next\ndata: {"errors":[…]}…`), the GraphQL errors inside it
  unread. Reading them is on the [roadmap](../roadmap.md).
- **A connection that fails or drops**: `ApiUnavailableError('unreachable')`;
  the client's `timeout` passing before the server answers:
  `ApiUnavailableError('timeout')`. The timeout bounds the connection until its
  headers arrive, never the subscription.
- **A 2xx that is not an event stream** (the server answered JSON):
  `ApiUnavailableError('invalid-response')`.
- **A 401**, as the HTTP status or as a GraphQL error's
  `extensions.http.status`, runs `onUnauthenticated` first, awaited; what it
  throws is what the loop gets. `@nxgt/httpyz`'s `auth.refresh` is tried for an
  HTTP 401 on connect.

```ts
import { isApiError } from '@nxgt/graphql-client';

try {
  for await (const { message } of client.subscribe(OnMessage, { room: 'r1' })) {
    render(message);
  }
} catch (error) {
  if (isApiError(error)) console.log(error.code);
  else throw error;
}

declare function render(message: { id: string; text: string }): void;
```

## Never retried, never shared

- **A subscription is never retried**: the client's and the call's `retry` do
  not apply to it, whatever the status or failure.
- **It does not reconnect** after a dropped connection: the loop rejects with
  `ApiUnavailableError('unreachable')`, and subscribing again is yours to do.
  Resuming where it stopped is on the [roadmap](../roadmap.md).
- **It is never deduplicated or batched**: two identical subscriptions open two
  connections.

## Persisted subscriptions

`persisted` applies as it does to queries (see
[Persisted queries](client.md#persisted-queries)):

- **`documentId`** posts the document's hash instead of its text; a document
  with no hash throws a `TypeError` from `subscribe`, before anything is sent.
- **`apq`** posts the text's SHA-256. When the server answers
  `PersistedQueryNotFound`, as a refused connection's JSON body or as the
  first event, nothing ran: the client connects once more with the text,
  exactly once. After a result was yielded, it is never sent again.

**On graphql-yoga, APQ subscriptions need `forceStatusCodeOk`.** By default
`@graphql-yoga/plugin-apq` answers `PersistedQueryNotFound` with HTTP 404, and
graphql-yoga sends it as a 404 event stream, which the client cannot read yet:
the loop rejects with `ApiStatusError(404)`, its `body` the stream's raw text,
and the text is never sent. Have the plugin answer 200, where the error is the
stream's first `next` event and the client resends:

```ts
import { useAPQ } from '@graphql-yoga/plugin-apq';
import { createYoga } from 'graphql-yoga';

const yoga = createYoga({
  schema, // your executable schema
  plugins: [useAPQ({ responseConfig: { forceStatusCodeOk: true } })],
});
```

Queries and mutations work either way: their 404 is a JSON body the client
reads.
