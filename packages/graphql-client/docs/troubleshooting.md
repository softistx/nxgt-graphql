# Troubleshooting

One entry per error you can hit, headed by the message you will search for.

- [`query() was given a mutation`](#query-was-given-a-mutation)
- [`mutate() was given a query`](#mutate-was-given-a-query)
- [`query() was given a subscription`, `mutate() was given a subscription`](#query-was-given-a-subscription-mutate-was-given-a-subscription)
- [`subscribe() was given a query`, `subscribe() was given a mutation`](#subscribe-was-given-a-query-subscribe-was-given-a-mutation)
- [`A subscription is read once`](#a-subscription-is-read-once)
- [A subscription that yields nothing](#a-subscription-that-yields-nothing)
- [`The document holds no operation`](#the-document-holds-no-operation)
- [`The document carries no persisted hash: enable persistedDocuments in the client preset`](#the-document-carries-no-persisted-hash-enable-persisteddocuments-in-the-client-preset)
- [`APQ needs crypto.subtle: serve the page over https or localhost`](#apq-needs-cryptosubtle-serve-the-page-over-https-or-localhost)
- [`PersistedQueryNotFound`](#persistedquerynotfound)
- [A batch reply that is not an array of the batch's length](#a-batch-reply-that-is-not-an-array-of-the-batchs-length)
- [`The API answered <status> with no GraphQL response`](#the-api-answered-status-with-no-graphql-response)
- [`The API could not be reached`](#the-api-could-not-be-reached)
- [`The API did not answer in time`](#the-api-did-not-answer-in-time)
- [`The API answered with neither data nor errors`](#the-api-answered-with-neither-data-nor-errors)
- [`cache-only: the cache does not hold the whole result of <operation>`](#cache-only-the-cache-does-not-hold-the-whole-result-of-operation)
- [`fetchPolicy 'cache-only' needs a cache: pass cache: normalizedCache() to createGraphQLClient`](#fetchpolicy-cache-only-needs-a-cache-pass-cache-normalizedcache-to-creategraphqlclient)
- [`With a cache, a persisted document needs __typename in every selection set: add the client preset's addTypenameSelectionDocumentTransform to its documentTransforms`](#with-a-cache-a-persisted-document-needs-__typename-in-every-selection-set-add-the-client-presets-addtypenameselectiondocumenttransform-to-its-documenttransforms)
- [`The cache stores an operation's data: an object`](#the-cache-stores-an-operations-data-an-object)
- [`The document has no fragment <name>`](#the-document-has-no-fragment-name)
- [A `cache-first` query that always goes to the network](#a-cache-first-query-that-always-goes-to-the-network)

## `query() was given a mutation`

**When:** calling `client.query(...)` with a mutation document. A `TypeError`.
**Why:** a mutation is never retried or shared, so it has its own method.
**Fix:**

```ts
await client.mutate(RenameUser, { id: '42', name: 'Ada' });
```

## `mutate() was given a query`

**When:** calling `client.mutate(...)` with a query document. A `TypeError`.
**Why:** queries retry and are deduplicated; a mutation does neither.
**Fix:**

```ts
await client.query(UserQuery, { id: '42' });
```

## `query() was given a subscription`, `mutate() was given a subscription`

**When:** calling `client.query(...)` or `client.mutate(...)` with a
subscription document. A `TypeError`.
**Why:** a subscription yields many results over an event stream; it has its
own method.
**Fix:**

```ts
for await (const { message } of client.subscribe(OnMessage, { room: 'r1' })) {
  console.log(message);
}
```

## `subscribe() was given a query`, `subscribe() was given a mutation`

**When:** calling `client.subscribe(...)` with a query or a mutation document.
A `TypeError`, thrown by `subscribe` itself, before anything is sent.
**Why:** a query or a mutation has one result; `subscribe` opens an event
stream for a subscription only.
**Fix:**

```ts
await client.query(UserQuery, { id: '42' });
await client.mutate(RenameUser, { id: '42', name: 'Ada' });
```

## `A subscription is read once`

**When:** a second `for await` (or `[Symbol.asyncIterator]()`) over the same
`Subscription`. A `TypeError`.
**Why:** each subscription is one connection; once read, it is spent.
**Fix:** call `subscribe` again for a new connection:

```ts
const watch = () => client.subscribe(OnMessage, { room: 'r1' });
for await (const event of watch()) handle(event);
for await (const event of watch()) handle(event); // a fresh connection
```

## A subscription that yields nothing

**When:** the loop over `client.subscribe(...)` ends at once, or never yields,
with no error.
**Why:** the server answers an event stream whose events are not named `next`
(an older or custom server sending unnamed `data:` events, which the client
ignores), or ends the stream before any result.
**Fix:** serve the GraphQL over SSE protocol's distinct connections mode:
graphql-yoga does it by default; elsewhere, mount graphql-sse's handler and
point the client at its route (see
[Subscriptions](guide/subscriptions.md#the-server)).

## `The document holds no operation`

**When:** a `TypedDocumentNode` (or a string) holds only fragments or
definitions, no `query` or `mutation`; or the document is the client preset's
hash-only object (`persistedDocuments: { mode: 'replaceDocumentWithHash' }`).
A `TypeError`.
**Why:** the client has nothing to send. Often a fragment was passed instead of
the operation that uses it. A hash-only document holds no text to read the
operation's name and kind from.
**Fix:**

```ts
await client.query(UserQuery, { id: '42' }); // the operation, not UserFragment
```

For persisted documents, keep the preset's default mode, which embeds the
hash in the full document:

```ts
presetConfig: { persistedDocuments: true } // mode: 'embedHashInDocument'
```

## `The document carries no persisted hash: enable persistedDocuments in the client preset`

**When:** the client has `persisted: { mode: 'documentId' }` and a call is
given a document with no `__meta__.hash`. A `TypeError`, thrown before
anything is sent.
**Why:** `documentId` mode sends the hash the client preset's
`persistedDocuments` writes on each document, never the text. Without that
option, or with another `hashPropertyName` than `hash`, there is no hash to
send.
**Fix:** enable it in the client preset, keep `hashPropertyName` at its
default, and regenerate:

```ts
// codegen.ts
const config = {
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: { persistedDocuments: true },
    },
  },
};
```

Or use `persisted: { mode: 'apq' }`, which needs no codegen setup.

## `APQ needs crypto.subtle: serve the page over https or localhost`

**When:** the client has `persisted: { mode: 'apq' }` and runs where
`globalThis.crypto.subtle` is missing. A `TypeError`, thrown before anything is
sent.
**Why:** APQ hashes the operation's text with SHA-256, and browsers expose
`crypto.subtle` only in secure contexts.
**Fix:** serve the page over https or from localhost, or use
`persisted: { mode: 'documentId' }`, which hashes nothing at runtime:

```ts
const client = createGraphQLClient({
  url,
  persisted: { mode: 'documentId' },
});
```

## `PersistedQueryNotFound`

**When:** an `ApiError` (`code` `PERSISTED_QUERY_NOT_FOUND`) reaches the caller
although the client resends the text once on `persisted: { mode: 'apq' }`.
Or, in `documentId` mode, the same error for a hash the server does not know.
**Why:** in `apq` mode the resend was answered `PersistedQueryNotFound` again:
the server has no APQ plugin, so it never registers the text. In `documentId`
mode the server's `persisted-documents.json` lacks the hash, or it does not read
the `documentId` field.
**Fix:** enable an APQ plugin on the server, or, for `documentId`, load the
preset's `persisted-documents.json` and tell the plugin to read the field:

```ts
import { useAPQ } from '@graphql-yoga/plugin-apq';

useAPQ(); // apq mode

usePersistedOperations({
  getPersistedOperation: (id) => persistedDocuments[id] ?? null,
  extractPersistedOperationId: (params) =>
    (params as { documentId?: string }).documentId ?? null,
}); // documentId mode
```

## A batch reply that is not an array of the batch's length

**When:** `batch` is on and every query of a batch rejects with the same
error: an `ApiUnavailableError('invalid-response')`, an `ApiStatusError`, or an
`ApiError` such as `Batching is not enabled`.
**Why:** the server answered the posted array with an object or an array of
another length, usually because it does not accept batches, or because `max` is
above its limit.
**Fix:** enable batching on the server, and keep `max` at or under its limit
(graphql-yoga's `batching: true` allows 10):

```ts
createYoga({ batching: { limit: 20 } }); // server
createGraphQLClient({ url, batch: { max: 20 } }); // client
```

## `The API answered <status> with no GraphQL response`

**When:** the API answers a non-2xx status whose body has no GraphQL `errors`
(a 401, 403, 404, or a gateway's 503), or whose reply is labelled JSON but does
not parse (a gateway's HTML page, a cut body). An `ApiStatusError`, with
`status` and `body` (undefined when the body did not parse).
On `subscribe`, it is also what a server answering an error status with an
event stream gives, never an `ApiError`: the client does not parse an error
status's event stream yet, so `body` is the stream's raw text, the GraphQL
errors inside it unread. graphql-yoga does it for a variable missing or of the
wrong type (a 400), for an error carrying `extensions.http.status` thrown
before the subscription starts, and for APQ's
`PersistedQueryNotFound` (a 404), which the client then does not resend.
**Why:** a proxy, a gateway or an auth layer answered before GraphQL ran; or,
on `subscribe`, the server put a GraphQL error in an error status's event
stream.
**Fix:** read `error.status` and `error.body`; for a 401, set
`onUnauthenticated` (see [Errors](guide/errors.md#onunauthenticated)). For an
APQ subscription answered 404 by graphql-yoga, have the plugin answer 200, so
the error comes as the stream's first event and the client resends the text
(see [Persisted subscriptions](guide/subscriptions.md#persisted-subscriptions)):

```ts
useAPQ({ responseConfig: { forceStatusCodeOk: true } });
```

```ts
if (error instanceof ApiStatusError) console.log(error.status, error.body);
```

## `The API could not be reached`

**When:** the request never got an answer: DNS, refused connection, offline;
or a subscription's connection dropped while it was read. An
`ApiUnavailableError`, `reason: 'unreachable'`.
**Why:** the network failed; `error.cause` holds the transport's error.
**Fix:** check the `url` (and `baseUrl` of an httpyz client), then retry the
query; set `retry` to do it for you. A subscription is never retried nor
reconnected: subscribe again.

```ts
const client = createGraphQLClient({ url, retry: 2 });
```

## `The API did not answer in time`

**When:** the `timeout` passed before an answer, or while the body was read. An `ApiUnavailableError`,
`reason: 'timeout'`.
**Why:** the API is slow, or the timeout is shorter than the operation needs.
**Fix:**

```ts
await client.query(SlowReport, undefined, { timeout: 30_000 });
```

## `The API answered with neither data nor errors`

**When:** a 2xx response whose body holds no `data` and no `errors`, or is
labelled JSON but does not parse; on `subscribe`, a 2xx that is not an event
stream, or a `next` event whose data is not JSON. An
`ApiUnavailableError`, `reason: 'invalid-response'`.
**Why:** the `url` points at something that is not a GraphQL endpoint (an HTML
page, an empty 200), or a proxy rewrote the body.
**Fix:** open the URL with a plain request and check it answers
`{ "data": ... }`; with an httpyz client, check `path` (default `/graphql`).

```ts
const client = createGraphQLClient({ http, path: '/graphql' });
```

## `cache-only: the cache does not hold the whole result of <operation>`

**When:** a query with `fetchPolicy: 'cache-only'` whose result the cache does
not hold whole. A `CacheMissError`, whose `operationName` names the operation;
nothing is sent.
**Why:** some field the document selects, for these variables, was never
written, or the entity holding it was evicted or reset.
**Fix:** fall back to the network, or query with `cache-first`, which does it
for you:

```ts
import { CacheMissError } from '@nxgt/graphql-client';

try {
  return await client.query(BookQuery, { id }, { fetchPolicy: 'cache-only' });
} catch (error) {
  if (!(error instanceof CacheMissError)) throw error;
  return client.query(BookQuery, { id }, { fetchPolicy: 'network-only' });
}
```

## `fetchPolicy 'cache-only' needs a cache: pass cache: normalizedCache() to createGraphQLClient`

**When:** a query with `fetchPolicy: 'cache-only'` on a client created without
`cache`. A `TypeError`, thrown before anything is sent.
**Why:** without a cache there is nothing to answer from. The other policies
are ignored without a cache: every query goes to the network.
**Fix:**

```ts
import { createGraphQLClient, normalizedCache } from '@nxgt/graphql-client';

const client = createGraphQLClient({ url, cache: normalizedCache() });
```

## `With a cache, a persisted document needs __typename in every selection set: add the client preset's addTypenameSelectionDocumentTransform to its documentTransforms`

**When:** the client has both `cache` and `persisted: { mode: 'documentId' }`,
and a query or a mutation is given a document with a selection set (other than
the operation's own) that has no `__typename`. A `TypeError`, thrown before
anything is sent.
**Why:** the cache needs each object's `__typename`. In other modes the client
adds it to the text it sends; in `documentId` mode it sends only the hash, and
the server runs the text it holds, so the document must carry `__typename`
already. The client preset does not add it by default.
**Fix:** add the preset's transform, and regenerate (the hashes and
`persisted-documents.json` change, so deploy them to the server too):

```ts
// codegen.ts
import { addTypenameSelectionDocumentTransform } from '@graphql-codegen/client-preset';

const config = {
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: { persistedDocuments: true },
      documentTransforms: [addTypenameSelectionDocumentTransform],
    },
  },
};
```

## `The cache stores an operation's data: an object`

**When:** `cache.write(document, variables, data)` with `data` that is not an
object (`null`, a list, a string). A `TypeError`.
**Why:** `data` is the operation's whole result, the object `query()` returns.
**Fix:**

```ts
cache.write(BookQuery, { id: '1' }, { book: { __typename: 'Book', id: '1', title: 'Dune' } });
```

## `The document has no fragment <name>`

**When:** with a cache, a document spreads `...<name>` but does not define that
fragment. A `TypeError` from the cache's read or write.
**Why:** a document built by hand, or a fragment left out of a hand-written
string. The client preset always includes the fragments a document spreads.
**Fix:** use the preset's document, or append the fragment's definition to the
document.

## A `cache-first` query that always goes to the network

**When:** with a cache, the same query sends a request every time.
**Why:** one of these makes every read a miss:

- the queries that ran before used `no-cache`, which writes nothing;
- different variables: each set of arguments is its own field;
- a fragment on an interface or a union with no `possibleTypes`, whose fields
  the cache cannot tell are whole;
- an entity it refers to was evicted.

**Fix:** pass `possibleTypes` from the `fragment-matcher` plugin, and check
what the cache holds:

```ts
console.log(client.cache?.read(BookQuery, { id: '1' })); // undefined: a miss
```
