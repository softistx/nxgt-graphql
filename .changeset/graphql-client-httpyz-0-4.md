---
"@nxgt/graphql-client": minor
---

Requires `@nxgt/httpyz` 0.4. A timeout that fires while the reply body is read now comes from httpyz itself.

What changes for you: a body-read timeout is still `ApiUnavailableError('timeout')`, but its `cause` is now httpyz's `TimeoutError` (message `reply body not read within <n> ms`, with `timeout`, `method` and `path`, the signal's `DOMException` as its own `cause`) instead of the bare `DOMException`. Code that reads `error.cause` for a timeout sees the change; code that reads `reason` does not. An httpyz client of your own from before 0.4, passed as `http`, still gets `ApiUnavailableError('timeout')` for it.

Unchanged: a subscription refused with an error status's event stream still rejects with `ApiStatusError`, its `body` the stream's raw text. The declarations now resolve fully under `moduleResolution: nodenext` too, so an unknown option to `createGraphQLClient` is a type error there, as it already was under `bundler`.
