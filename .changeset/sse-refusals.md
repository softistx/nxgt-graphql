---
"@nxgt/graphql-client": minor
---

**Breaking: a subscription refused with an error status's event stream now rejects with the `ApiError` the stream carries**, instead of an `ApiStatusError` holding the stream's raw text. graphql-yoga refuses a subscription that way before it starts: a variable missing or of the wrong type (400), an error carrying `extensions.http.status` thrown before the subscription starts (that status), and APQ's `PersistedQueryNotFound` (404). The client reads the body's events with `@nxgt/httpyz`'s `createSseParser`, and the first `next` event whose data carries GraphQL `errors` becomes the same `ApiError` a refused JSON body gives: `status` is `extensions.http.status`, else the HTTP status; `httpStatus` is the response's status as it came; the 401 hook (`onUnauthenticated`) runs for a 401 as it does for JSON.

APQ subscriptions on graphql-yoga now work with `useAPQ()`'s defaults: the 404 event stream is read as `PersistedQueryNotFound`, and the client connects once more with the query text, exactly once. `useAPQ({ responseConfig: { forceStatusCodeOk: true } })`, which 0.3 needed, is no longer required; it still works.

Unchanged: an error status's event stream with no GraphQL errors in it (no `next` event, a result without `errors`, data that is not JSON) is still an `ApiStatusError(status)` whose `body` is the stream's raw text, and a refused body that cannot be read is still an `ApiStatusError(status)` with `body` undefined and the read error as `cause`. Queries and mutations are not affected.

Migration: code that caught `ApiStatusError` for a refused subscription and parsed its `body` for `event: next` gets an `ApiError` now. Test it with `isApiError(error)` and read `error.errors`, `error.code` and `error.status` (or `error.httpStatus` for the HTTP status as it came) instead of parsing the text. If you set `forceStatusCodeOk` on graphql-yoga's `useAPQ` only for this client's subscriptions, you can remove it.
