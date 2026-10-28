---
'@nxgt/graphql-client': minor
---

`subscribe` takes an `onOpen` option, called when the server accepted the stream (a 2xx response), before any event, so a quiet stream is known to be open without a timer. It is not called for a refused connection, and an error it throws is logged and does not end the subscription. Fixes #130.
