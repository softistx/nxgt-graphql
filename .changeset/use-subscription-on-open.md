---
'@nxgt/graphql-client': minor
---

`useSubscription` takes an `onOpen` option, forwarded to `subscribe`: called once the server accepted the stream, before any result, so a component knows a quiet stream is open. It is kept in a ref, so a new function on a render does not reconnect. Fixes #132.
