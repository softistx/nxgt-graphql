# @nxgt/graphql-client

A typed GraphQL client for the documents the graphql-codegen client preset
writes (`TypedDocumentNode`, or `TypedDocumentString`), built on
[`@nxgt/httpyz`](https://www.npmjs.com/package/@nxgt/httpyz): the variables you
pass and the data you get back are typed from the document, and every failure
is a typed error.

> Not published yet.

## Install

```sh
bun add @nxgt/graphql-client graphql typescript
```

Peers, both **required**:

| Peer | Range |
| --- | --- |
| `graphql` | `^16.11.0 \|\| ^17.0.0` |
| `typescript` | `^6.0.3 \|\| ^7.0.0` |

`@nxgt/httpyz` is a dependency; you import its types from it only when you
pass your own client.

## Setup

The client takes the documents the client preset writes. Either mode works:

```ts
// codegen.ts
const config = {
  generates: {
    'src/gql/': {
      preset: 'client',
      // presetConfig: { documentMode: 'string' } to get TypedDocumentString
    },
  },
};
```

`documentMode: 'documentNode'` (the default) writes `TypedDocumentNode`s;
`documentMode: 'string'` writes `TypedDocumentString`s, sent as written.

## Subpaths

Only `.` is exported.

## Usage

### Create a client, run a query

```ts
import { createGraphQLClient } from '@nxgt/graphql-client';
import { graphql } from './gql';

const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  headers: { 'x-client': 'web' },
  timeout: 10_000,
});

const UserQuery = graphql(`
  query User($id: ID!) {
    user(id: $id) { id name }
  }
`);

const { user } = await client.query(UserQuery, { id: '42' });
```

`mutate` is the same for a mutation. Variables are optional when the operation
requires none. See [Client](docs/guide/client.md).

### Handle the errors

```ts
import { ApiUnavailableError, isApiError } from '@nxgt/graphql-client';

try {
  await client.query(UserQuery, { id: '42' });
} catch (error) {
  if (isApiError(error)) console.log(error.code, error.fields);
  else if (error instanceof ApiUnavailableError) console.log(error.reason);
  else throw error;
}
```

See [Errors](docs/guide/errors.md).

## Traps

- **Never share a client between users on a server.** Headers carry the user's
  token; create one client per incoming request.
- **`onUnauthenticated` may be async, and runs once per caller.** Keep its side
  effects idempotent; a GraphQL-level 401 on an HTTP 200 gets no refresh (see
  [Errors](docs/guide/errors.md#onunauthenticated)).
- **A mutation is never retried**, and `query()` refuses a mutation document
  (and `mutate()` a query) with a `TypeError`.
- **Identical in-flight queries share one request.** Pass `dedupe: false` to
  turn it off.

## Documentation

- [Guide index](docs/README.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
