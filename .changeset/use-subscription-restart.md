---
'@nxgt/graphql-client': minor
---

`useSubscription` handles a bounded stream: new options `onComplete` (the stream ended cleanly), `onError` and `onUnauthenticated` (a 401 or an `UNAUTHENTICATED` error), and a stable `restart()` in the returned state that reopens the stream with the same variables. Additive. Fixes #136.
