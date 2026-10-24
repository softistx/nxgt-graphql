# @nxgt/graphql-codegen-msw

A [graphql-codegen](https://the-guild.dev/graphql/codegen) plugin that writes
one typed [msw](https://mswjs.io) 3 handler per named query and mutation of
your documents: `mockUserQuery(resolver, options?)`, built on msw's
`graphql.link(endpoint)`. Each handler checks the variables it receives with
the Zod schema
[`@nxgt/graphql-codegen-zod`](https://www.npmjs.com/package/@nxgt/graphql-codegen-zod)
writes for that operation, so the mock refuses what your server refuses, and
answers an invalid input as your API does, without calling your resolver. For
graphql-codegen 5 to 7 (ESM), `graphql` 16 and 17, and msw 3.

## Install

```sh
bun add -d @nxgt/graphql-codegen-msw @nxgt/graphql-codegen-zod @graphql-codegen/cli msw
bun add graphql zod typescript
```

Peers, all **required**:

| Peer | Range |
| --- | --- |
| `msw` | `^3.0.3` |
| `graphql` | `^16.11.0 \|\| ^17.0.0` |
| `zod` | `>=4.6.5 <5` |
| `typescript` | `^6.0.3 \|\| ^7.0.0` |

The generated file imports `@nxgt/graphql-codegen-msw/runtime` at run time:
keep the package wherever the mocks run. A dev dependency is enough for tests
and a development server; a production build that ships its mocks (a demo
mode) needs it as a dependency. `@nxgt/graphql-validation`, which builds the
refusals, comes with it, and `./runtime` re-exports what a function of your
own builds with (`invalidInputError`, `fieldsError`, `fieldIssueOf`,
`inputPath`, the types `Translate`, `FieldIssue`, `FieldError`): import them
from `@nxgt/graphql-codegen-msw/runtime`. An application that also imports
`@nxgt/graphql-validation` itself needs `^0.4.0`.

## Setup

The schema must declare `@constraint` (the first entry below) when it uses
it, and `scalarSchemas` names the module holding a schema per custom scalar;
drop either from the example when your schema has no `@constraint` or no
custom scalar. Three outputs go in one folder: the client preset's files (its
`graphql.ts` holds each operation's result and variables types), the Zod
schemas `@nxgt/graphql-codegen-zod` writes (`zod.ts`), and the handlers
(`msw.ts`).

```ts
// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
	schema: ['generated/graphql/constraint.graphqls', 'src/schema/**/*.graphql'],
	documents: 'src/operations/**/*.graphql',
	generates: {
		// The operations' types: the client preset...
		'src/generated/': { preset: 'client' },
		'src/generated/zod.ts': {
			plugins: ['@nxgt/graphql-codegen-zod'],
			config: { scalarSchemas: '@nxgt/graphql-scalars' },
		},
		'src/generated/msw.ts': {
			plugins: ['@nxgt/graphql-codegen-msw'],
			config: {
				endpoint: 'https://api.example.com/graphql',
				schemasImport: './zod',
				typesImport: './graphql',
			},
		},
	},
};
export default config;
```

Without the client preset, `typescript-operations` writes the same types
(`typesImport: './types'` then names its file):

```ts
'src/generated/types.ts': {
	plugins: ['typescript', 'typescript-operations'],
},
```

Where they come from: `generated/graphql/constraint.graphqls` is written by
`bunx nxgt-graphql-validation typedefs --out` (see
[`@nxgt/graphql-validation`](https://www.npmjs.com/package/@nxgt/graphql-validation)),
and `@nxgt/graphql-scalars` is `bun add @nxgt/graphql-scalars`, which exports
the `scalarSchemas` record codegen-zod reads.

`schemasImport` and `typesImport` are written into the generated imports as
you give them, relative to the generated file. Under `moduleResolution:
nodenext`, give them the `.js` extension: `'./zod.js'`, `'./graphql.js'`.

For an operation

```graphql
query User($id: ID!) { user(id: $id) { id name } }
```

the plugin writes

```ts
export const endpoint = "https://api.example.com/graphql";
export const invalidInput: InvalidInput = invalidInputRefusal();

export function mockUserQuery(
	resolver: GraphQLMockResolver<UserQuery, UserQueryVariables>,
	options?: MockOptions,
): GraphQLHandler { … }
```

## Usage

### Answer an operation

A resolver is msw's own: it receives msw's resolver info, `variables` typed
with the operation's variables type, and answers with `HttpResponse.json`,
its `data` typed with the operation's result type.

```ts
import { HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { mockSignUpMutation, mockUserQuery } from './generated/msw';

export const worker = setupWorker(
	mockUserQuery(({ variables }) =>
		HttpResponse.json({ data: { user: { id: String(variables.id), name: 'Ada' } } }),
	),
	mockSignUpMutation(() => HttpResponse.json({ data: { signUp: { id: 'u_1' } } })),
);
```

The resolver runs only once the variables pass the operation's schema
(`zUserQueryVariables`): `@constraint` rules, input types, scalars. It receives
the variables as sent, not parsed.

### An invalid input

By default, the handler answers an invalid input with one 400 error that
lists the refused fields, one per Zod issue: the shape of
[`invalidInputError`](https://www.npmjs.com/package/@nxgt/graphql-validation),
for an API that answers invalid input that way.

```json
{
  "errors": [{
    "message": "validation.errors.invalid-input",
    "extensions": {
      "code": "validation.errors.invalid-input",
      "fields": [
        { "path": "person.firstName", "code": "validation.errors.too-short",
          "message": "validation.errors.too-short" }
      ]
    }
  }]
}
```

The codes are `too-short`, `too-long`, `out-of-range`, `too-few`, `too-many`,
`invalid-format` (a format or a pattern) and `invalid` (anything else, a
prefix, suffix or substring included), under `validation.errors.`, with no
params: `@nxgt/graphql-validation`'s `fieldIssueOf`, the mapping a server
using it applies. Each message is its code, unless you name a translator:
`translate: './i18n#translate'`.

A value the API refuses before its validation (a missing or `null` value for a
non-null type, a wrong type, an unknown enum value or input field, an Int
beyond 32 bits, a value a custom scalar refuses) is answered as graphql-yoga
answers it, whatever `invalidInput` is: status 400, one plain error per
problem in graphql 17's wording, types named and "Did you mean …?" included,
no `extensions` (except a value a `zodScalar` refuses, which carries the
scalar's own `{ code: 'INVALID_SCALAR', scalar, reason }`, as
[`@nxgt/graphql-scalars`](https://www.npmjs.com/package/@nxgt/graphql-scalars)
puts it on the server). The generated file describes the input types from the
schema for it. The few cases where the mock still differs are listed in
[the handlers guide](./docs/guide/handlers.md#known-differences).

```json
{ "errors": [{ "message": "Variable \"$id\" of required type \"ID!\" was not provided.", "locations": [{ "line": 1, "column": 12 }] }] }
```

Any other invalid input, a constraint, gets the answer `invalidInput` picks:

| `invalidInput` | Answer |
| --- | --- |
| `'invalid-input'` (default) | one 400 error listing the fields, as above |
| `'bad-user-input'` | the `BAD_USER_INPUT` error `withValidation` raises, status 200 |
| `'<module>#<export>'` | your function's error and status |

```ts
// src/mocks/invalid-input.ts, for invalidInput: '../mocks/invalid-input#invalidInput'
import type { InvalidInput } from '@nxgt/graphql-codegen-msw/runtime';

export const invalidInput: InvalidInput = (issues, operation) => ({
	error: { message: `${operation.name}: ${issues[0]?.message}`, extensions: { code: 'INVALID' } },
	status: 422,
});
```

### Refuse from the resolver

Throw a `GraphQLError`, as your server's resolver would: the handler answers
`{ errors: [error] }` at its `extensions.http.status`, else 200. Or return
`errorResponse(error, { status })`. As graphql-yoga does, the body leaves out
`extensions.http` (and `extensions.unexpected`), and several errors answer at
the highest status among them.

```ts
import { errorResponse, fieldsError } from '@nxgt/graphql-codegen-msw/runtime';

mockSignUpMutation(() => {
	throw fieldsError('person.errors.duplicate', [{ path: 'person.email', code: 'person.errors.email-taken' }], { status: 409 });
});
mockUserQuery(() => errorResponse({ message: 'Not found', extensions: { code: 'NOT_FOUND' } }));
```

Anything else a resolver throws is msw's to answer: a 500.

### Options per handler

`options` takes msw's own (`once`) and an `endpoint` for that handler only:

```ts
mockUserQuery(resolver, { endpoint: 'https://staging.example.com/graphql', once: true });
```

### In tests

```ts
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockUserQuery } from './generated/msw';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('shows the user', async () => {
	server.use(mockUserQuery(() => HttpResponse.json({ data: { user: null } })));
	// …
});
```

Under Bun, msw 3's `setupServer` intercepts no `fetch`: see
[Under Bun](docs/guide/handlers.md#under-bun).

## Options

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `endpoint` | `string` | required | where the client sends its operations, a URL or a path msw matches (`'*/graphql'`) |
| `schemasImport` | `string` | required | the module `@nxgt/graphql-codegen-zod` writes, as the generated file imports it |
| `typesImport` | `string` | required | the module exporting each operation's result and variables types: the client preset's `graphql.ts`, or `typescript-operations`' file |
| `invalidInput` | `'invalid-input' \| 'bad-user-input' \| '<module>#<export>'` | `'invalid-input'` | how an invalid input is answered |
| `translate` | `'<module>#<export>'` | none | a `Translate` for the default answer's messages |
| `schemaPrefix` | `string` | `'z'` | as `@nxgt/graphql-codegen-zod`'s |
| `namingConvention`, `typesPrefix`, `typesSuffix`, `dedupeOperationSuffix`, `omitOperationSuffix` | | | as the typescript plugins read them: set them at the root of the codegen config, for the three files alike |

Each is detailed in [Handlers](docs/guide/handlers.md).

## Traps

- A handler is written for a **named** query or mutation. An anonymous
  operation has no name for msw to match, and a subscription none: msw 3 mocks
  subscriptions over WebSocket only (see the [roadmap](docs/roadmap.md)).
- Take the types from the client preset or `typescript-operations` (the wire
  types), not from codegen-zod's file, whose result types are decoded (a
  `DateTime` is a `Date` there).
- The resolver receives the variables as sent: a `DateTime` is its string, a
  default is not filled in. Parse them with the schema when you need the
  decoded values: `zSignUpMutationVariables.parse(variables)`.
- A generator resolver is refused: msw would answer the next requests from
  its iterator, without checking their variables. Register one handler per
  answer with `{ once: true }`.
- `msw/node`'s `setupServer` intercepts nothing under Bun (msw 3.0.3, Bun
  1.4.2): run those tests under Node, or see
  [Under Bun](docs/guide/handlers.md#under-bun).
- Persisted queries and batched requests are not matched (see the roadmap).

Every error and its fix is in [Troubleshooting](docs/troubleshooting.md).

## Documentation

The package exports `plugin` and the `CodegenMswConfig` and `DocumentFile`
types from `.`; graphql-codegen finds `plugin` by the package name. The
generated file's runtime is `./runtime`: `mockOperation`,
`invalidInputRefusal`, `badUserInputRefusal`, `errorResponse`,
`isGraphQLError` and their types, and, re-exported from
`@nxgt/graphql-validation`, `invalidInputError`, `fieldsError`,
`fieldIssueOf`, `inputPath`, `Translate`, `FieldIssue` and `FieldError`.

- [Documentation index](docs/README.md)
- Guides: [Handlers](docs/guide/handlers.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
