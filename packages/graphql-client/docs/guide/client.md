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
client you pass; `retry`, `dedupe` and `onUnauthenticated` stay available.

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
mutation is never sent twice. `retry` is a number of attempts, or httpyz's
`RetryOptions` without `methods`; `false` turns it off for the call.

```ts
const client = createGraphQLClient({ url, retry: 2 });

await client.query(UserQuery, { id: '42' }, { retry: { attempts: 4, statuses: [503] } });
await client.query(UserQuery, { id: '42' }, { retry: false });
```

## Deduplication

Identical queries in flight share one request. "Identical" means the same
text, variables, headers, timeout and retry.

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
