# Errors

A failure of `query` and `mutate` from the API is one of three classes: an
`ApiError`, an `ApiStatusError` or an `ApiUnavailableError`. The call can also
reject with the signal's own reason, with a `CacheMissError` (a `cache-only`
query the cache cannot answer), or with a `TypeError` for a mistake in the
call itself (a wrong kind of document, `cache-only` without a cache, the rest
in [Troubleshooting](../troubleshooting.md)).

```ts
import {
  ApiStatusError,
  ApiUnavailableError,
  isApiError,
} from '@nxgt/graphql-client';

try {
  await client.query(UserQuery, { id: '42' });
} catch (error) {
  if (isApiError(error)) console.log(error.code, error.status, error.message);
  else if (error instanceof ApiStatusError) console.log(error.status, error.body);
  else if (error instanceof ApiUnavailableError) console.log(error.reason, error.cause);
  else throw error;
}
```

| Class | When | Message |
| --- | --- | --- |
| `ApiError` | the response carries `errors` | the first error's message |
| `ApiStatusError` | a non-2xx status with no GraphQL `errors`, or whose reply is labelled JSON but does not parse | `The API answered <status> with no GraphQL response` |
| `ApiUnavailableError` | no GraphQL answer to read | by `reason`, below |
| the signal's reason | the call's `signal` aborted | whatever the signal holds |
| `CacheMissError` | a `cache-only` query whose result the cache does not hold whole | `cache-only: the cache does not hold the whole result of <operation>` |
| `TypeError` | a mistake in the call, such as `fetchPolicy: 'cache-only'` on a client without `cache` | `fetchPolicy 'cache-only' needs a cache: pass cache: normalizedCache() to createGraphQLClient`, and the others in [Troubleshooting](../troubleshooting.md) |

## ApiError

The response carried `errors`. Its summaries read the first error; `errors`
keeps them all.

```ts
class ApiError extends Error {
  readonly errors: readonly ApiErrorEntry[];
  readonly data: unknown;
  readonly httpStatus: number;
  get extensions(): ApiErrorExtensions;
  get code(): string | undefined;
  get status(): number;
  get params(): ApiErrorParams;
  get fields(): readonly ApiFieldError[];
}
```

| Member | Value |
| --- | --- |
| `errors` | every entry of the response's `errors` |
| `data` | the response's `data`, when the API resolved part of it |
| `httpStatus` | the HTTP status the response came with |
| `extensions` | the first error's `extensions`, every key of them |
| `code` | `extensions.code` |
| `status` | `extensions.http.status`, else the HTTP status |
| `params` | `extensions.params`: values a message interpolates, `{ retryAfter: 30 }` |
| `fields` | the refused fields, below |

`fields` is `extensions.fields` as the API sends it. When there are none, it
reads `@nxgt/graphql-validation`'s `extensions.issues`, joining each `path`
with dots (`['person', 'firstName']` becomes `person.firstName`).

```ts
try {
  await client.mutate(CreatePerson, { input });
} catch (error) {
  if (isApiError(error)) {
    for (const { path, code, message } of error.fields) {
      console.log(`${path}: ${code} (${message})`);
    }
    console.log(error.params['retryAfter'], error.extensions['custom']);
  }
}
```

### isApiError

`isApiError(error)` narrows to `ApiError`, and also recognises one from another
copy of this package (a second install in `node_modules`), where `instanceof`
fails. Prefer it to `instanceof ApiError`.

## ApiStatusError

A status that is not a success, with no GraphQL body: a 401, 403, 404, a
gateway's 503. A reply labelled JSON that does not parse (a gateway's HTML page
under a JSON header, a cut body) is the same error with `body` undefined and
`cause` set to the transport's parse error.

```ts
class ApiStatusError extends Error {
  readonly status: number;
  readonly body: unknown; // read by its media type, when there was one
  // cause: the transport's parse error, for a non-2xx labelled JSON that does not parse
}
```

```ts
if (error instanceof ApiStatusError && error.body === undefined) {
  console.log(error.status, error.cause); // what did not parse, and why
}
```

## ApiUnavailableError

```ts
type UnavailableReason = 'unreachable' | 'timeout' | 'invalid-response';

class ApiUnavailableError extends Error {
  readonly reason: UnavailableReason;
  // cause: the transport's error, for unreachable, timeout, and an unparsable 2xx
}
```

| `reason` | Message | When |
| --- | --- | --- |
| `unreachable` | `The API could not be reached` | the network failed |
| `timeout` | `The API did not answer in time` | the `timeout` passed, before the answer or while its body was read |
| `invalid-response` | `The API answered with neither data nor errors` | a 2xx with no `data` and no `errors`, or labelled JSON that does not parse |

## CacheMissError

A query with `fetchPolicy: 'cache-only'` whose result the cache does not hold
whole: some field it selects, for these variables, was never written, or its
entity was evicted. Nothing is sent. Without a cache at all, `cache-only`
throws a `TypeError` instead, naming the fix.

```ts
class CacheMissError extends Error {
  readonly operationName: string | undefined; // 'Book'
}
```

```ts
import { CacheMissError } from '@nxgt/graphql-client';

try {
  await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'cache-only' });
} catch (error) {
  if (error instanceof CacheMissError) await client.query(BookQuery, { id: '1' });
  else throw error;
}
```

An error thrown by the cache itself after the network answered (a watch
callback, a `keys` function) never fails the call: it is reported, see
[Errors in the cache](cache.md#errors-in-the-cache).

## Aborts

When the call's `signal` aborts, the call rejects with the signal's reason, not
with an `ApiUnavailableError`. A signal already aborted wins over a cache hit
too. A subscription's loop does the same, and its
connection closes.

```ts
const controller = new AbortController();
const pending = client.query(UserQuery, { id: '42' }, { signal: controller.signal });
controller.abort(new Error('navigated away'));
await pending.catch((error) => console.log(error.message)); // navigated away
```

## onUnauthenticated

Runs when the API answers 401, as the HTTP status or as a GraphQL error's
`extensions.http.status`. What it throws is what the caller gets; when it
returns, the caller gets the `ApiError` or `ApiStatusError`. Without it, the
error surfaces unchanged. It may be async: the call waits for it.

- **HTTP 401**: it runs after `@nxgt/httpyz`'s `auth.refresh` did not save the
  call (a refresh that works never reaches it).
- **A GraphQL error with `extensions.http.status` 401 on an HTTP 200**: it runs
  directly. `auth.refresh` only replays on an HTTP 401, so no refresh is tried.
  Have the server answer HTTP 401 for it, or refresh inside the hook so the
  next call carries a fresh token.
- **On `subscribe`**: it runs for a refused connection's 401 and for a `next`
  event's GraphQL 401, before the loop rejects.
- **Once per caller.** Deduplicated callers share one request but each runs the
  hook, so a hook that throws a redirect reaches every caller. Keep its side
  effects idempotent.

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';

class SignedOut extends Error {}

const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  auth: { token: () => session.token, refresh: () => session.renew() },
  onUnauthenticated: async () => {
    await session.forget(); // idempotent: every deduplicated caller runs it
    throw new SignedOut('Sign in again');
  },
});

declare const session: { token: string; renew(): Promise<void>; forget(): Promise<void> };
```

## Mapping errors to an HTTP response

A server route that answers its own caller from the API's failure. The code is
framework-agnostic: it returns a standard `Response`.

```ts
import {
  ApiStatusError,
  ApiUnavailableError,
  isApiError,
} from '@nxgt/graphql-client';

export function toResponse(error: unknown): Response {
  if (isApiError(error)) {
    return Response.json(
      { code: error.code, message: error.message, params: error.params, fields: error.fields },
      { status: error.status },
    );
  }
  if (error instanceof ApiStatusError) {
    return Response.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof ApiUnavailableError) {
    const status = error.reason === 'timeout' ? 504 : 502;
    return Response.json({ message: error.message, reason: error.reason }, { status });
  }
  throw error; // an abort, or a bug: not the API's failure
}

export async function handle(request: Request): Promise<Response> {
  try {
    const data = await client.query(UserQuery, { id: '42' }, { signal: request.signal });
    return Response.json(data);
  } catch (error) {
    return toResponse(error);
  }
}
```

Problems: [Troubleshooting](../troubleshooting.md). Back to [Client](client.md).
