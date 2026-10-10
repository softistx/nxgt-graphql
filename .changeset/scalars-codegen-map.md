---
"@nxgt/graphql-scalars": minor
---

`codegenScalars` and `clientCodegenScalars`: graphql-codegen's `scalars` config for every scalar of the package, for a server (`typescript-resolvers`) and for a client (`typescript-operations`). Each entry is read from the scalar's schema, and a spec holds it to the type tsc gives `z.input` and `z.output`. A server gets `{ input: 'Date', output: 'Date | string' }` for `DateTime`, a client `{ input: 'string | Date', output: 'string' }`.

**Breaking, for resolver authors:** `serialize` now also takes the wire form a resolver returns, which it refused before: an ISO string for `DateTime`, the milliseconds for `Timestamp`, a safe number or a decimal string for `Long` and `BigInt`. The value is decoded, then encoded, so what goes out is canonical (`'2024-03-10T12:00:00+02:00'` is written `'2024-03-10T10:00:00.000Z'`). A value neither form takes is still refused, with the same message as before. This holds for every `zodScalar`, a custom codec included: its wire form is decoded, then encoded. A `DateTime` string with `-00:00` or outside 0000–9999, and a `Long` or `BigInt` number past 2^53, are still refused.
