---
"@nxgt/graphql-client": patch
---

Requires `@nxgt/httpyz` ^0.4.1, so an install cannot pick 0.4.0. A reply whose body is cut off mid-read (the connection drops after the headers) is now `ApiUnavailableError('unreachable')`, its `cause` httpyz's `NetworkError` (message ending `reply body cut off`). Before, the runtime's raw `TypeError` escaped. It is not retried, since the reply came.
