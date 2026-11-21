---
'@nxgt/graphql-client': minor
---

Add an `onResponse(response)` call option to `query`, `mutate` and `execute`: it receives the call's HTTP `Response`, so its headers (`Set-Cookie`, `Retry-After`, a request id) are readable per call, for a failed answer too. A call that sets it is sent on its own, never shared with an identical query nor batched. Fixes #156.
