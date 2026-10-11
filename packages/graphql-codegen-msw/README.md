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
refusals, comes with it.

## Setup

Three files, generated side by side: the operations' types (the client
preset's `graphql.ts`, or `typescript-operations`' file), the Zod schemas of
`@nxgt/graphql-codegen-zod`, and the handlers.

```ts
// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
	schema: ['generated/graphql/constraint.graphqls', 'src/schema/**/*.graphql'],
	documents: 'src/operations/**/*.graphql',
	generates: {
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

By default, an invalid input is answered as an API that answers invalid input
as one 400 error with a list of fields:
[`invalidInputError`](https://www.npmjs.com/package/@nxgt/graphql-validation)'s
shape, one field per Zod issue.

```json
{
  "errors": [{
    "message": "validation.errors.invalid-input",
    "extensions": {
      "code": "validation.errors.invalid-input",
      "http": { "status": 400 },
      "fields": [
        { "path": "person.firstName", "code": "validation.errors.too_small",
          "message": "validation.errors.too_small", "params": { "min": 2 } }
      ]
    }
  }]
}
```

Each message is its code, unless you name a translator:
`translate: './i18n#translate'`. Two other answers:

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
`errorResponse(error, { status })`.

```ts
import { fieldsError } from '@nxgt/graphql-validation';
import { errorResponse } from '@nxgt/graphql-codegen-msw/runtime';

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
`invalidInputRefusal`, `badUserInputRefusal`, `fieldIssueOf`, `errorResponse`,
`isGraphQLError` and their types.

- [Documentation index](docs/README.md)
- Guides: [Handlers](docs/guide/handlers.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
