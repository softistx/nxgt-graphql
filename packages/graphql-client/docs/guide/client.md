# Client

How to create a client, run queries and mutations, and what each option does.

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';
import { graphql } from './gql';

const client = createGraphQLClient({ url: 'https://api.example.com/graphql' });

const Hello = graphql(`query Hello { hello }`);
const { hello } = await client.query(Hello);
```

## Documents

`query` and `mutate` take what the client preset writes: a `TypedDocumentNode`
(`documentMode: 'documentNode'`, the default) or a `TypedDocumentString`
(`documentMode: 'string'`). Both carry the result and variables types.

```ts
import type { GraphQLDocument } from '@nxgt/graphql-client';

// GraphQLDocument<TResult, TVariables> = DocumentTypeDecoration<TResult, TVariables>
```

A document node is printed once, a string is sent as written; both are read
once and cached. A document with no operation throws a `TypeError`
(see [troubleshooting](../troubleshooting.md)).

## Creating a client

Two shapes, never both.

### With `url`

The client builds its own `@nxgt/httpyz` client, and accepts its options.

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';

let token = 'abc';

const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  headers: { 'x-client': 'web' },
  timeout: 10_000,
  auth: {
    token: () => token,
    refresh: async () => {
      token = await fetchNewToken();
    },
  },
});

declare function fetchNewToken(): Promise<string>;
```

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `url` | `string \| URL` | required | the GraphQL endpoint, sent as the base URL |
| `fetch` | `(request: Request) => Response \| Promise<Response>` | `globalThis.fetch` | sends each request; takes a `Request`, so a Hono `app.fetch` fits and is the mock hook in tests |
| `headers` | `HeadersInit \| () => HeadersInit \| Promise<HeadersInit>` | none | sent with every request |
| `timeout` | `number` | none | milliseconds before the call fails (`ApiUnavailableError`, reason `timeout`), reading the body included |
| `auth` | `{ token, refresh?, scheme? }` | none | a bearer token on every request, refreshed once on a 401 |
| `init` | fetch options | none | `credentials`, `mode`, `cache`… |
| `use` | httpyz middleware | none | around every request |
| `retry` | `number \| Omit<RetryOptions, 'methods'> \| false` | none | retries of a query |
| `dedupe` | `boolean` | `true` | identical in-flight queries share one request |
| `persisted` | `false \| { mode: 'documentId' } \| { mode: 'apq' }` | `false` | operations sent by a hash instead of their text; see [Persisted queries](#persisted-queries) |
| `batch` | `false \| { max?: number; wait?: number }` | `false` | queries issued together posted as one array; see [Batching](#batching) |
| `onUnauthenticated` | `(error) => void \| Promise<void>` | none | see [Errors](errors.md#onunauthenticated) |

Mocking in a test:

```ts
const client = createGraphQLClient({
  url: 'http://test/graphql',
  fetch: async (request) => {
    const { query } = (await request.json()) as { query: string };
    return Response.json({ data: { hello: `got ${query.length} chars` } });
  },
});
```

### Over an existing httpyz client

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';
import { createHttpClient } from '@nxgt/httpyz';

const http = createHttpClient({ baseUrl: 'https://api.example.com' });

const client = createGraphQLClient({ http, path: '/graphql' });
```

`path` defaults to `/graphql`. The transport is on `client.http` for what is
not GraphQL. `url`-only options (`headers`, `timeout`, `auth`…) belong to the
client you pass; `retry`, `dedupe`, `persisted`, `batch` and
`onUnauthenticated` stay available.

```ts
import type { GraphQLClient, GraphQLClientOptions } from '@nxgt/graphql-client';
```

## Query and mutate

```ts
interface GraphQLClient {
  query<TResult, TVariables>(
    document: GraphQLDocument<TResult, TVariables>,
    // NoInfer: the document alone sets the variables' type
    ...args: VariablesArgs<NoInfer<TVariables>, QueryOptions>
  ): Promise<TResult>;
  mutate<TResult, TVariables>(
    document: GraphQLDocument<TResult, TVariables>,
    ...args: VariablesArgs<NoInfer<TVariables>, CallOptions>
  ): Promise<TResult>;
  readonly http: HttpClient;
}
```

Both return the response's `data`; any GraphQL error throws. Variables are
required when the operation has a required one, optional otherwise. The
document alone sets their type, so a key the operation does not declare is a
type error.

```ts
const { user } = await client.query(UserQuery, { id: '42' }); // variables required
const { hello } = await client.query(Hello);                  // none needed

const { renameUser } = await client.mutate(RenameUser, { id: '42', name: 'Ada' });
```

Per-call options:

| Option | Type | Applies to | Effect |
| --- | --- | --- | --- |
| `signal` | `AbortSignal` | both | aborts the call: it rejects with the signal's reason |
| `headers` | `HeadersInit` | both | over the client's headers, for this call |
| `timeout` | `number` | both | milliseconds, instead of the client's |
| `retry` | `number \| Omit<RetryOptions, 'methods'> \| false` | `query` only | instead of the client's |

```ts
const controller = new AbortController();
await client.query(UserQuery, { id: '42' }, {
  signal: controller.signal,
  headers: { 'x-request-id': 'r1' },
  timeout: 2_000,
});
```

`query()` refuses a mutation document and `mutate()` a query, with a
`TypeError` (`query() was given a mutation`).

## Retry

Only a query retries, and always over POST, which is how GraphQL is sent. A
mutation is never sent twice, with one exception that is not a retry: in
`apq` mode, a mutation the server answered `PersistedQueryNotFound` is sent once
more with its text, because the server did not run it (see
[Persisted queries](#persisted-queries)). `retry` is a number of attempts, or httpyz's
`RetryOptions` without `methods`; `false` turns it off for the call.

```ts
const client = createGraphQLClient({ url, retry: 2 });

await client.query(UserQuery, { id: '42' }, { retry: { attempts: 4, statuses: [503] } });
await client.query(UserQuery, { id: '42' }, { retry: false });
```

## Deduplication

Identical queries in flight share one request. "Identical" means the same
text, variables, headers, timeout and retry. A `retry.delay` function is not
compared: two queries differing only in it share one request, sent with the
first one's.

```ts
const [a, b] = await Promise.all([
  client.query(UserQuery, { id: '42' }),
  client.query(UserQuery, { id: '42' }), // one request on the wire
]);
```

- Each caller's `signal` aborts only that caller, which rejects with the
  signal's reason.
- The shared request is aborted when every caller has left.
- Mutations are never shared.
- `dedupe: false` on the client turns it off.

## Persisted queries

Off by default. Each mode sends a hash in place of the operation's text, so
the server must be set up for it. The options are typed by two exports:

```ts
import type { BatchOptions, PersistedQueries } from '@nxgt/graphql-client';
```

### `documentId`: the client preset's hashes

The client preset's `persistedDocuments` writes a hash on each document
(`__meta__.hash`) and a `persisted-documents.json` mapping each hash to its
text, which the server loads.

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

```ts
const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  persisted: { mode: 'documentId' },
});

await client.query(UserQuery, { id: '42' });
// posts { "documentId": "<hash>", "variables": { "id": "42" }, "operationName": "User" }
```

- No text is sent. On the server, graphql-yoga's `usePersistedOperations`
  (`@graphql-yoga/plugin-persisted-operations`) looks the hash up in the
  preset's `persisted-documents.json`. With its defaults it reads only
  `extensions.persistedQuery.sha256Hash`, whereas the client sends the
  GraphQL-over-HTTP `documentId` field, so tell it where to read:

  ```ts
  usePersistedOperations({
    getPersistedOperation: (id) => persistedDocuments[id] ?? null,
    extractPersistedOperationId: (params) =>
      (params as { documentId?: string }).documentId ?? null,
  });
  ```
- Both document modes work: the hash is read from the `DocumentNode` or from
  the `TypedDocumentString`.
- Keep the preset's defaults `hashPropertyName: 'hash'` and
  `mode: 'embedHashInDocument'`: the client reads `__meta__.hash`, and a
  `replaceDocumentWithHash` document holds no operation to read
  ([troubleshooting](../troubleshooting.md#the-document-holds-no-operation)).
- A document with no hash throws a `TypeError` before anything is sent
  ([troubleshooting](../troubleshooting.md#the-document-carries-no-persisted-hash-enable-persisteddocuments-in-the-client-preset)).

### `apq`: Automatic Persisted Queries

```ts
const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  persisted: { mode: 'apq' },
});
```

- The first post carries only the SHA-256 of the exact text the client sends,
  in hex, computed once per operation:
  `{ "variables": …, "operationName": …, "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "<hex>" } } }`.
- When the server answers that it does not hold the hash (an error with
  `extensions.code` `PERSISTED_QUERY_NOT_FOUND`, or the message
  `PersistedQueryNotFound`), the client posts once more with the `query` and the
  same `extensions`, and the server registers it. Later calls send the hash
  alone.
- **This resend applies to mutations too.** The server did not run the
  operation, so nothing is done twice. It is the only case where a mutation is
  posted twice.
- No codegen setup is needed. On the server, enable an APQ plugin, such as
  graphql-yoga's `useAPQ` from `@graphql-yoga/plugin-apq`.
- **The hash needs `crypto.subtle`**, which browsers expose only in secure
  contexts (https or localhost). Without it the call throws a `TypeError` before
  anything is sent
  ([troubleshooting](../troubleshooting.md#apq-needs-cryptosubtle-serve-the-page-over-https-or-localhost)).

## Batching

Off by default. Queries issued together are posted as one JSON array, and the
reply, an array in the same order, gives each query its own result.

```ts
const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  batch: { max: 10, wait: 0 },
});

const [user, settings] = await Promise.all([
  client.query(UserQuery, { id: '42' }),
  client.query(SettingsQuery),
]); // one request: [{ "query": …User… }, { "query": …Settings… }]
```

| Option | Default | Effect |
| --- | --- | --- |
| `max` | `10` | the most queries in one request; a full batch leaves at once, the next query starts another. Rounded down, at least `1`; a non-finite value (`NaN`) is the default |
| `wait` | `0` | milliseconds a batch waits for more queries; `0` collects what is issued in the same macrotask |

- **The server must accept batches**: graphql-yoga's `batching: true`, which
  allows 10 queries per request; `batching: { limit }` sets another. `max` must
  not exceed the server's limit, or a full batch is refused.
- **Queries only.** A mutation is always posted alone.
- **Only queries with the same per-call `headers`, `timeout` and `retry` share
  a batch**; the others go in batches of their own.
- **A batch of one is posted as a plain body**, as without batching.
- **Each query gets its own result or error.** An entry with `errors` rejects
  that query alone, with an `ApiError` carrying the reply's HTTP status. A
  reply that is not an array of the batch's length rejects every query with
  the error the whole reply stands for: its `ApiError` (any status) when the
  body carries `errors`, an `ApiStatusError` on a non-2xx, else an
  `ApiUnavailableError('invalid-response')`.
- **Each query keeps its own `signal`.** Aborted before the batch leaves, it
  rejects with its reason and is dropped from the batch; once the batch is
  sent, the request is aborted only when every query in it has left.
- **Deduplication comes first**: identical queries share one entry.
- **With persisted queries**, each entry carries its own `documentId` or
  `persistedQuery` hash; in `apq` mode, an entry the server does not hold yet
  is posted again alone, with its text.

## On a server

Create one client per incoming request, and never share it between users: the
headers carry that user's token, and identical queries from two users must not
meet.

```ts
import { Hono } from 'hono';
import { createGraphQLClient } from '@nxgt/graphql-client';

const app = new Hono();

app.get('/me', async (c) => {
  const client = createGraphQLClient({
    url: 'https://api.example.com/graphql',
    headers: { authorization: c.req.header('authorization') ?? '' },
    timeout: 5_000,
  });
  const { me } = await client.query(MeQuery, undefined, { signal: c.req.raw.signal });
  return c.json(me);
});
```

Next: [Errors](errors.md).
