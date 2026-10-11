# Handlers

What the plugin writes from your operations, how each handler checks its
variables and answers an invalid input, and the runtime the generated file
calls.

## The smallest example

```graphql
# schema
input PersonInput {
  firstName: String! @constraint(minLength: 2)
  email: String! @constraint(format: "email")
}
input SignUpInput { person: PersonInput!, tags: [String!] @constraint(maxItems: 2) }
type User { id: ID!, name: String! }
type Query { user(id: ID! @constraint(minLength: 3)): User }
type Mutation { signUp(input: SignUpInput!): User }
```

```graphql
# documents
query User($id: ID!) { user(id: $id) { id name } }
mutation SignUp($input: SignUpInput!) { signUp(input: $input) { id name } }
```

```ts
// codegen.ts, beside the client preset and @nxgt/graphql-codegen-zod
'src/generated/msw.ts': {
	plugins: ['@nxgt/graphql-codegen-msw'],
	config: {
		endpoint: 'https://api.example.com/graphql',
		schemasImport: './zod',
		typesImport: './graphql',
	},
},
```

The plugin writes:

```ts
import type { GraphQLHandler } from "msw/graphql";
import { type GraphQLMockResolver, type MockOptions, type InvalidInput, mockOperation, invalidInputRefusal } from "@nxgt/graphql-codegen-msw/runtime";
import type { UserQuery, UserQueryVariables, SignUpMutation, SignUpMutationVariables } from "./graphql";
import { zUserQueryVariables, zSignUpMutationVariables } from "./zod";

/** Where the client sends its operations; a handler's `options.endpoint` overrides it. */
export const endpoint = "https://api.example.com/graphql";

/** How an invalid input is answered, without calling the resolver. */
export const invalidInput: InvalidInput = invalidInputRefusal();

/** Mocks the User query: `resolver` answers once the variables pass `zUserQueryVariables`. */
export function mockUserQuery(
	resolver: GraphQLMockResolver<UserQuery, UserQueryVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "query", name: "User", variables: zUserQueryVariables, endpoint, invalidInput }, resolver, options);
}

/** Mocks the SignUp mutation: … */
export function mockSignUpMutation(…): GraphQLHandler { … }
```

One handler factory per **named query and mutation**, in document order. The
schema is not read: the documents name everything the file needs.

## What each import is

### `typesImport`: the operations' types

The module exporting each operation's result type and variables type, named
as `typescript-operations` names them (`UserQuery`, `UserQueryVariables`):

- the client preset's `graphql.ts`: `typesImport: './graphql'`, with the
  preset generating into the same folder;
- or the file `typescript-operations` writes: `typesImport: './operations'`.

Both write the wire types: what the response holds as JSON, what the client
sends. Do not point `typesImport` at codegen-zod's file: its result types are
`z.output`, decoded (`joined` is a `Date` there), and its variables types
`z.input`; the handler would compile, but its `data` would not be what the
wire holds.

The plugin imports the types only (`import type`), never a document: msw
matches an operation by its name, so the mock bundle carries no document.

### `schemasImport`: the variables' schemas

The file `@nxgt/graphql-codegen-zod` writes. Each handler imports that
operation's variables schema, `z<Operation>Variables` (`zUserQueryVariables`),
which carries every `@constraint` of every argument or input field the
variable reaches, the input types (`z.strictObject`) and your custom scalars.
That is the schema a client checks before sending: the mock refuses what the
server refuses.

### Naming: one config for the three files

The plugin names the types as `typescript-operations` does and the schemas as
codegen-zod does (`schemaPrefix`, default `z`, before the type's name). Put
the naming options at the **root** of the codegen config, so every output
reads them:

```ts
const config: CodegenConfig = {
	config: { omitOperationSuffix: false, typesPrefix: '' },
	generates: { … },
};
```

| Option | Effect on the names |
| --- | --- |
| `namingConvention` | `'keep'`, `'change-case-all#<case>'`, a function, or `{ typeNames, transformUnderscore }`, as the typescript plugins read it |
| `typesPrefix`, `typesSuffix` | around each type's name, the schema's included (`zIUserQueryVariables`) |
| `dedupeOperationSuffix` | `query UserQuery` is `UserQuery`, not `UserQueryQuery` |
| `omitOperationSuffix` | no `Query` or `Mutation` suffix |
| `schemaPrefix` | before each schema's name, as codegen-zod's |

The handler is `mock` and the operation's converted name with its suffix,
without `typesPrefix` or `typesSuffix`: `mockUserQuery`, `mockSignUpMutation`.
Two operations converting to one name (`getUser` and `GetUser`) fail
generation.

### The paths

`schemasImport`, `typesImport`, and the modules of `invalidInput` and
`translate` are written into the generated imports as you give them: a path
relative to the generated file, or a package. The plugin loads none of them;
a wrong path or export fails the generated file's typecheck, which names it.
Under `moduleResolution: nodenext` (or `node16`), give a relative path its
`.js` extension: `'./zod.js'`.

## The endpoint

`endpoint` is what msw's `graphql.link(endpoint)` takes: the URL your client
posts to, `'https://api.example.com/graphql'`, or a path msw matches on any
origin, `'*/graphql'` (a relative `'/graphql'` resolves against the page in a
browser). It is exported, so a test can read it:

```ts
import { endpoint } from './generated/msw';
```

One handler can answer elsewhere: `mockUserQuery(resolver, { endpoint:
'https://staging.example.com/graphql' })`, any msw path, a `RegExp` included.

## The resolver

`GraphQLMockResolver<Result, Variables>` is msw's GraphQL resolver, its
`variables` typed with the operation's variables type and its answer's `data`
with the result type. It receives msw's resolver info: `variables`, `query`,
`operationName`, `request`, `cookies`, `requestId`, `finalize`.

```ts
mockUserQuery(async ({ variables, request }) => {
	if (!request.headers.get('authorization')) return errorResponse({ message: 'Sign in', extensions: { http: { status: 401 } } });
	return HttpResponse.json({ data: { user: { id: String(variables.id), name: 'Ada' } } });
});
```

It answers as an msw resolver does:

- `HttpResponse.json({ data })`: the response;
- `undefined`: the next handler answers (msw's own fall-through);
- `errorResponse(error, { status })`: `{ errors: [error] }` at `status`, else
  the error's `extensions.http.status`, else 200;
- a thrown `GraphQLError` (from any copy of `graphql`): the same as
  `errorResponse(error)`, so the resolver can throw what your server's throws
  (`invalidInputError`, `fieldsError`, `badUserInput`);
- anything else thrown: msw answers 500, as it does for any resolver.

`variables` are **the variables as sent**: checked, not parsed. A `DateTime`
is still its string, an absent variable with a default is still absent. When
you need the decoded values, parse them yourself:

```ts
mockSignUpMutation(({ variables }) => {
	const { input } = zSignUpMutationVariables.parse(variables); // input.birth is a Date
	…
});
```

A **generator** resolver (`function*`) is refused, by its type and at run
time: msw keeps the iterator it returns and answers the next requests from it
without calling the handler again, so their variables would go unchecked.
Register one handler per answer, each `{ once: true }`, in the order they
should answer:

```ts
server.use(
	mockUserQuery(() => HttpResponse.json({ data: { user: first } }), { once: true }),
	mockUserQuery(() => HttpResponse.json({ data: { user: second } })),
);
```

## An invalid input

Before the resolver runs, the handler parses the variables with the
operation's schema (`safeParseAsync`, so an asynchronous format of yours
works). When they fail, the resolver is not called: the handler answers with
the generated `invalidInput`'s error and status, as `{ errors: [error] }`.

### `'invalid-input'`, the default

For an API that answers invalid input as one 400 error with a list of fields:
`invalidInputError` from `@nxgt/graphql-validation`, one field per Zod issue,
in the order Zod reports them.

| Field | From the Zod issue |
| --- | --- |
| `path` | `inputPath(issue.path)`: dotted, the leading `input` dropped (`person.firstName`, `tags.1`); another variable keeps its name (`first`) |
| `code` | `validation.errors.<issue.code>`: `validation.errors.too_small`, `validation.errors.invalid_format`, `validation.errors.invalid_type`, … |
| `params` | `{ min }` for `too_small`, `{ max }` for `too_big`, `{ format }` for `invalid_format`; none otherwise |
| `message` | `translate(code, params)`, or the code without `translate` |

```json
{
  "errors": [{
    "message": "validation.errors.invalid-input",
    "extensions": {
      "code": "validation.errors.invalid-input",
      "http": { "status": 400 },
      "fields": [
        { "path": "person.firstName", "code": "validation.errors.too_small", "message": "validation.errors.too_small", "params": { "min": 2 } },
        { "path": "person.email", "code": "validation.errors.invalid_format", "message": "validation.errors.invalid_format", "params": { "format": "email" } },
        { "path": "tags", "code": "validation.errors.too_big", "message": "validation.errors.too_big", "params": { "max": 2 } }
      ]
    }
  }]
}
```

The status is 400. `fieldIssueOf(issue)` is the mapping above, exported from
`./runtime` for a function of your own that keeps it.

#### `translate`

```ts
config: { …, translate: '../i18n#translate' }
```

```ts
// src/i18n.ts
import type { Translate } from '@nxgt/graphql-validation';

export const translate: Translate = (code, params) => messages[code]?.(params) ?? code;
```

The generated file writes `invalidInputRefusal({ translate })`: the error's
message is `translate('validation.errors.invalid-input')`, each field's
`translate(code, params)`. `translate` goes with the default answer only; with
another `invalidInput`, generation fails.

### `'bad-user-input'`

The error `withValidation` raises on a server: `extensions.code`
`BAD_USER_INPUT`, `extensions.issues` each with its `path`, Zod's `message`
and `code`, the message `Invalid arguments for <operation>. <path>: <first
message>`. Status 200, as a GraphQL server answers a resolver's error.

```json
{
  "errors": [{
    "message": "Invalid arguments for SignUp. input.person.firstName: Too small: expected string to have >=2 characters",
    "extensions": {
      "code": "BAD_USER_INPUT",
      "issues": [{ "path": ["input", "person", "firstName"], "message": "Too small: expected string to have >=2 characters", "code": "too_small" }]
    }
  }]
}
```

Three differences with the server's: `<operation>` is the operation's name
(`SignUp`), where the server names the field (`Mutation.signUp`); each path
starts with the variable's name, where the server's starts with the
argument's (the first two are the same when the variable is named after the
argument); and the mock answers `{ errors }` alone, with no `data`, and no
`path` or `locations` on the error, which the server's execution adds. There
is no `constraint` on an issue, as on a client.

### `'<module>#<export>'`: your own

A function typed `InvalidInput`:

```ts
type InvalidInput = (
	issues: readonly z.core.$ZodIssue[],
	operation: { readonly type: 'query' | 'mutation'; readonly name: string },
) => InvalidInputAnswer | Promise<InvalidInputAnswer>;

interface InvalidInputAnswer {
	readonly error: GraphQLError | GraphQLFormattedError;
	readonly status: number;
}
```

`issues` are Zod's, each `path` starting with the variable's name. The
handler answers `{ errors: [error] }` at `status`; a `GraphQLError` is
written through its `toJSON()`.

```ts
// src/mocks/invalid-input.ts
import { fieldIssueOf, type InvalidInput } from '@nxgt/graphql-codegen-msw/runtime';
import { invalidInputError } from '@nxgt/graphql-validation';
import { translate } from '../i18n';

/** The default shape, with the application's own codes. */
export const invalidInput: InvalidInput = (issues) => ({
	error: invalidInputError(
		issues.map((issue) => {
			const field = fieldIssueOf(issue);
			return issue.code === 'too_small' && issue.origin === 'string'
				? { ...field, code: 'validation.errors.too-short' }
				: field;
		}),
		{ translate },
	),
	status: 400,
});
```

```ts
config: { …, invalidInput: '../mocks/invalid-input#invalidInput' }
```

The generated file writes `export const invalidInput: InvalidInput =
<your export>;`, so a function that does not fit the type fails the generated
file's typecheck.

## In tests

`setupServer` from `msw/node`, under Node:

```ts
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockUserQuery } from './generated/msw';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('a missing user', async () => {
	server.use(mockUserQuery(() => HttpResponse.json({ data: { user: null } })));
	// render, fetch, assert
});
```

`server.use(a, b)` puts `a` and `b` before the handlers already there, `a`
first.

### Under Bun

msw/node's `setupServer` intercepts no request under Bun (measured with msw
3.0.3 on Bun 1.4.2): its `fetch` interceptor works through Node's sockets,
which Bun's `fetch` does not use, so the request goes to the network. Two ways
around it:

- run the tests that need `setupServer` under Node;
- or build msw's network yourself from msw's experimental API and the
  interceptors' web `fetch` interceptor, which patches the global `fetch`
  only. This package's own specs do it (add `@mswjs/interceptors` at msw's
  version as a dev dependency):

```ts
import { FetchInterceptor } from '@mswjs/interceptors/fetch/web';
import { defineNetwork, InterceptorSource } from 'msw/experimental';

const network = defineNetwork({
	// The cast: the interceptors package declares its base class once per build.
	sources: [new InterceptorSource({ interceptors: [new FetchInterceptor() as never] })],
	handlers: [],
	onUnhandledFrame: 'error',
	context: { quiet: true },
});
beforeAll(() => network.enable());
afterEach(() => network.resetHandlers());
afterAll(() => network.disable());

test('a missing user', async () => {
	network.use(mockUserQuery(() => HttpResponse.json({ data: { user: null } })));
});
```

`msw/experimental` may change in a minor msw release.

## What gets no handler

- **An anonymous operation**: msw matches by name, and has none to match.
- **A subscription**: msw 3 mocks subscriptions over WebSocket
  (`graphql-transport-ws`) only, through another resolver shape. See the
  [roadmap](../roadmap.md).
- **A fragment**: it is not an operation.

Persisted queries (a request with a hash and no query text) and batched
requests (an array of operations in one POST) are not matched either.

## The runtime

`@nxgt/graphql-codegen-msw/runtime` is what the generated file calls. It
imports `msw`, `msw/graphql`, `zod` and `@nxgt/graphql-validation` at run
time, never the plugin.

```ts
declare function mockOperation<Result extends GraphQLQuery, Variables extends GraphQLVariables>(
	operation: MockedOperation,
	resolver: GraphQLMockResolver<Result, Variables>,
	options?: MockOptions,
): GraphQLHandler;

interface MockedOperation {
	readonly type: 'query' | 'mutation';
	readonly name: string;
	readonly variables: z.ZodType;
	readonly endpoint: Path;
	readonly invalidInput: InvalidInput;
}

interface MockOptions extends RequestHandlerOptions { // msw's: `once`
	readonly endpoint?: Path;
}

declare function invalidInputRefusal(options?: { readonly translate?: Translate }): InvalidInput;
declare const badUserInputRefusal: InvalidInput;
declare function fieldIssueOf(issue: z.core.$ZodIssue): FieldIssue;
declare function errorResponse(
	error: AnyGraphQLError | readonly AnyGraphQLError[],
	init?: { readonly status?: number },
): HttpResponse<{ errors: GraphQLFormattedError[] }>;
declare function isGraphQLError(value: unknown): value is GraphQLError;
```

Types: `GraphQLMockResolver`, `GraphQLMockInfo`, `MockedOperation`,
`MockOptions`, `InvalidInput`, `InvalidInputAnswer`, `RefusedOperation`,
`AnyGraphQLError`.

`mockOperation` is the generated handlers' only call: you can write a handler
the plugin does not, for an operation outside your documents, with it.

## The plugin function

```ts
import { type CodegenMswConfig, plugin } from '@nxgt/graphql-codegen-msw';

declare function plugin(
	schema: GraphQLSchema,
	documents: readonly DocumentFile[],
	config?: CodegenMswConfig,
): string;
```

graphql-codegen finds `plugin` by the package name. It throws, before writing
anything, on a missing option or one it cannot read; each message is in
[Troubleshooting](../troubleshooting.md).
