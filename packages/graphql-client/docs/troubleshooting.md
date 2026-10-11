# Troubleshooting

One entry per error you can hit, headed by the message you will search for.

- [`query() was given a mutation`](#query-was-given-a-mutation)
- [`mutate() was given a query`](#mutate-was-given-a-query)
- [`The document holds no operation`](#the-document-holds-no-operation)
- [`The API answered <status> with no GraphQL response`](#the-api-answered-status-with-no-graphql-response)
- [`The API could not be reached`](#the-api-could-not-be-reached)
- [`The API did not answer in time`](#the-api-did-not-answer-in-time)
- [`The API answered with neither data nor errors`](#the-api-answered-with-neither-data-nor-errors)

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

## `The document holds no operation`

**When:** a `TypedDocumentNode` (or a string) holds only fragments or
definitions, no `query` or `mutation`. A `TypeError`.
**Why:** the client has nothing to send. Often a fragment was passed instead of
the operation that uses it.
**Fix:**

```ts
await client.query(UserQuery, { id: '42' }); // the operation, not UserFragment
```

## `The API answered <status> with no GraphQL response`

**When:** the API answers a non-2xx status whose body has no GraphQL `errors`
(a 401, 403, 404, or a gateway's 503), or whose reply is labelled JSON but does
not parse (a gateway's HTML page, a cut body). An `ApiStatusError`, with
`status` and `body` (undefined when the body did not parse).
**Why:** a proxy, a gateway or an auth layer answered before GraphQL ran.
**Fix:** read `error.status` and `error.body`; for a 401, set
`onUnauthenticated` (see [Errors](guide/errors.md#onunauthenticated)).

```ts
if (error instanceof ApiStatusError) console.log(error.status, error.body);
```

## `The API could not be reached`

**When:** the request never got an answer: DNS, refused connection, offline. An
`ApiUnavailableError`, `reason: 'unreachable'`.
**Why:** the network failed; `error.cause` holds the transport's error.
**Fix:** check the `url` (and `baseUrl` of an httpyz client), then retry the
query; set `retry` to do it for you.

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
labelled JSON but does not parse. An
`ApiUnavailableError`, `reason: 'invalid-response'`.
**Why:** the `url` points at something that is not a GraphQL endpoint (an HTML
page, an empty 200), or a proxy rewrote the body.
**Fix:** open the URL with a plain request and check it answers
`{ "data": ... }`; with an httpyz client, check `path` (default `/graphql`).

```ts
const client = createGraphQLClient({ http, path: '/graphql' });
```
