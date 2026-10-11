# Errors

Every failure of `query` and `mutate` is one of four things: an `ApiError`, an
`ApiStatusError`, an `ApiUnavailableError`, or the signal's own reason.

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
| `ApiStatusError` | a non-2xx status with no GraphQL `errors` | `The API answered <status> with no GraphQL response` |
| `ApiUnavailableError` | no GraphQL answer to read | by `reason`, below |
| the signal's reason | the call's `signal` aborted | whatever the signal holds |

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
gateway's 503.

```ts
class ApiStatusError extends Error {
  readonly status: number;
  readonly body: unknown; // read by its media type, when there was one
}
```

## ApiUnavailableError

```ts
type UnavailableReason = 'unreachable' | 'timeout' | 'invalid-response';

class ApiUnavailableError extends Error {
  readonly reason: UnavailableReason;
  // cause: the transport's error, for unreachable and timeout
}
```

| `reason` | Message | When |
| --- | --- | --- |
| `unreachable` | `The API could not be reached` | the network failed |
| `timeout` | `The API did not answer in time` | the `timeout` passed |
| `invalid-response` | `The API answered with neither data nor errors` | a success with no `data` and no `errors` |

## Aborts

When the call's `signal` aborts, the call rejects with the signal's reason, not
with an `ApiUnavailableError`.

```ts
const controller = new AbortController();
const pending = client.query(UserQuery, { id: '42' }, { signal: controller.signal });
controller.abort(new Error('navigated away'));
await pending.catch((error) => console.log(error.message)); // navigated away
```

## onUnauthenticated

Runs when the API answers 401, as the HTTP status or as a GraphQL error's
`extensions.http.status`, and `@nxgt/httpyz`'s `auth.refresh` did not save the
call (a refresh that works never reaches it). What it throws is what the caller
gets; when it returns, the caller gets the `ApiError` or `ApiStatusError`.
Without it, the error surfaces unchanged.

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';

class SignedOut extends Error {}

const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  auth: { token: () => session.token, refresh: () => session.renew() },
  onUnauthenticated: () => {
    throw new SignedOut('Sign in again');
  },
});

declare const session: { token: string; renew(): Promise<void> };
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
