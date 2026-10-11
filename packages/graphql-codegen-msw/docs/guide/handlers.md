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
import { type GraphQLMockResolver, type MockOptions, type InvalidInput, type InputTypes, mockOperation, invalidInputRefusal } from "@nxgt/graphql-codegen-msw/runtime";
import type { UserQuery, UserQueryVariables, SignUpMutation, SignUpMutationVariables } from "./graphql";
import { zUserQueryVariables, zSignUpMutationVariables } from "./zod";

/** Where the client sends its operations; a handler's `options.endpoint` overrides it. */
export const endpoint = "https://api.example.com/graphql";

/** How an invalid input is answered, without calling the resolver. */
export const invalidInput: InvalidInput = invalidInputRefusal();

/**
 * The input types the variables reach, from the schema: how a handler words
 * a value graphql refuses. Internal: its shape may change in any version.
 */
const inputTypes: InputTypes = {
	DateTime: { kind: "scalar" },
	ID: { kind: "builtin" },
	PersonInput: {
		kind: "input",
		fields: {
			firstName: "String!",
			email: "String!",
		},
	},
	SignUpInput: {
		kind: "input",
		fields: {
			person: "PersonInput!",
			tags: "[String!]",
			birth: "DateTime",
		},
	},
	String: { kind: "builtin" },
};

/** Mocks the User query: `resolver` answers once the variables pass `zUserQueryVariables`. */
export function mockUserQuery(
	resolver: GraphQLMockResolver<UserQuery, UserQueryVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "query", name: "User", variables: zUserQueryVariables, variableTypes: { id: "ID!" }, inputTypes, endpoint, invalidInput }, resolver, options);
}

/** Mocks the SignUp mutation: … */
export function mockSignUpMutation(…): GraphQLHandler { … }
```

One handler factory per **named query and mutation**, in document order. The
schema gives `inputTypes`, every input type the variables reach (sorted by
name, an input object's fields and an enum's values one per line, so a schema
change shows as the lines it changes), and each handler's `variableTypes`: the
answer to a value graphql
refuses is worded from them (see
[What the API refuses before your resolvers](#what-the-api-refuses-before-your-resolvers)).
Their shape is internal to the generated file and the runtime, and may change
in any version; regenerate after an upgrade.

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
  the error's `extensions.http.status` (the highest, for several errors),
  else 200, a status no response can carry (outside 200–599, or 204, 205,
  304) ignored; the body leaves out `extensions.http` and
  `extensions.unexpected`, as graphql-yoga does;
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
works). When they fail, the resolver is not called. The handler answers in
two steps, always in this order:

1. a value the API refuses while coercing the variables is answered as
   graphql-yoga answers it, whatever `invalidInput` is (see
   [What the API refuses before your resolvers](#what-the-api-refuses-before-your-resolvers));
2. any other invalid input, a constraint, with the generated
   `invalidInput`'s error and status, as `{ errors: [error] }`.

### What the API refuses before your resolvers

graphql-yoga checks the variables against their GraphQL types before it
executes anything: a missing value for a non-null type, a `null` for one, a
value of the wrong type (a number for a `String`, an `Int` beyond 32 bits), an
unknown enum value, an input field the type does not declare, a value a
custom scalar refuses. Your server's validation never sees these, so its
invalid-input answer never names them. The mock answers them as graphql-yoga
5.24 on graphql 17 does:

- status **400**, under `Accept: application/json` and
  `application/graphql-response+json` alike;
- one plain GraphQL error per problem, `{ message, locations }`, with no
  `extensions`: no `code`, no `fields`;
- the message in graphql 17's wording, every type named as the schema names
  it and graphql's "Did you mean …?" included, located at the variable's
  definition in the query sent;
- each value printed as the API prints it: two levels deep and ten items
  (`{ a: { b: [Object] } }`, `[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ... 2 more items]`) in graphql's
  own messages (a scalar's, an enum's), three levels and every item in the
  executor's (an input object's, the `got invalid value …` prefix);
- the errors in graphql's order: variables as declared, an input object's
  fields as the schema declares them, its unknown fields last.

```json
{
  "errors": [
    { "message": "Variable \"$id\" of required type \"ID!\" was not provided.", "locations": [{ "line": 1, "column": 12 }] },
    { "message": "Variable \"$role\" got invalid value \"ADMN\"; Value \"ADMN\" does not exist in \"Role\" enum. Did you mean the enum value \"ADMIN\"?", "locations": [{ "line": 1, "column": 26 }] }
  ]
}
```

When graphql refuses any variable, the whole request gets this answer and no
other: the constraint issues beside it are not reported, as the API never
reaches its validation. It applies whatever `invalidInput` is, a function of
yours included, which therefore only receives the issues graphql would let
through.

How it is decided: the generated file describes, from the schema, every input
type the variables reach (`inputTypes`) and each variable's type
(`variableTypes`). The handler walks the variables sent as graphql walks
them. A built-in scalar, an enum, an input object, a list and a non-null type
are judged as graphql judges them, from the declared type and the value,
never from a Zod issue: an `Int` past 32 bits is refused as the API refuses
it, an `@constraint(max: 50)` exceeded is not. A custom scalar refuses where
the operation's Zod schema has an issue at its position.

| What is sent | The API's refusal, and the mock's |
| --- | --- |
| a non-null variable left out | `Variable "$id" of required type "ID!" was not provided.` |
| `null` for a non-null variable | `Variable "$id" of non-null type "ID!" must not be null.` |
| a value of the wrong type | `Variable "$id" got invalid value true; ID cannot represent value: true`, as graphql words `String`, `Int`, `Float`, `Boolean` and `ID` |
| an `Int` beyond 32 bits | `… got invalid value 3000000000; Int cannot represent non 32-bit signed integer value: 3000000000` |
| an unknown enum value | `… Value "ADMN" does not exist in "Role" enum. Did you mean the enum value "ADMIN"?`, or `Enum "Role" cannot represent non-string value: 5.` |
| an input object missing a required field | `… got invalid value { email: "a@b.co" } at "input.person"; Expected value of type "PersonInput" to include required field "firstName", found: { email: "a@b.co" }.` |
| `null` for a non-null field or list item | `… got invalid value null at "input.person.firstName"; Expected value of non-null type "String!" not to be null.` |
| an unknown input field | `… Expected value of type "SignUpInput" not to include unknown field "tag". Did you mean "tags"? Found: { … }.` |
| something else than an object | `… Expected value of type "SignUpInput" to be an object, found: "x".` |
| a value a custom scalar refuses | `… got invalid value "x" at "input.birth"; DateTime cannot represent this input: Invalid ISO datetime` |
| a `@oneOf` input object without exactly one non-null field | `… Within OneOf Input Object type "Pick", exactly one field must be specified, and the value for that field must be non-null.` |

A list also takes a single value, as graphql coerces it: `"MEMBR"` for
`[Role!]` is refused at `roles`, an item of `["ADMIN", "MEMBR"]` at
`roles[1]`.

### Known differences

Checked against graphql-yoga 5.24.2, `@graphql-tools/executor` 2.0.3 and
graphql 17.0.2 over 75 requests (missing, null and wrongly typed values at the
top level and nested, unknown enum values and fields, Int overflow, custom
scalars, lists and lists of lists, single values for lists, `@oneOf`, values
printed deep or long: `[Object]`, `[Array]`, `... 2 more items`): 74 answers
are identical, status and body. Where the mock differs:

- **An `ID` given an integer**, the one difference of the 75. graphql takes
  `5` for an `ID` (as `"5"`); codegen-zod's schema for `ID` is a string, so
  the mock refuses it with `invalidInput`'s answer
  (`validation.errors.invalid` by default).
- **A custom scalar of another make.** The mock words a custom scalar's
  refusal as a scalar built with `zodScalar` (`@nxgt/graphql-scalars`) does,
  `<Name> cannot represent this input: <the schema's first issue>`, which
  holds when the client's schema is the scalar's own. A scalar of another make
  words its refusal its own way (graphql's `Expected value of type "X", found:
  …` when it returns nothing, `…, but encountered error "…"; found: …` when it
  throws a plain `Error`).
- **An application format's code.** A format of the application's own
  (`withValidation`'s `formats`, a Zod string schema) is answered with the
  code its Zod issue gives: `validation.errors.invalid-format` only for a
  Zod format or a pattern, `validation.errors.invalid` for a refinement, a
  prefix, a suffix or a substring. The API may answer `invalid-format` for
  every format of its own.
- **An API on graphql 16.** graphql 16 words some of these messages
  differently; the mock always words them as graphql 17 does.

### `'invalid-input'`, the default

For an API that answers invalid input as one 400 error with a list of fields:
`invalidInputError` from `@nxgt/graphql-validation`, one field per Zod issue,
in the order Zod reports them.

| Field | From the Zod issue |
| --- | --- |
| `path` | `inputPath(issue.path)`: dotted, the leading `input` dropped (`person.firstName`, `tags.1`); another variable keeps its name (`first`) |
| `code` | the constraint, as in the table below |
| `message` | `translate(code)`, or the code without `translate` |

| Zod issue | `code` |
| --- | --- |
| `too_small` / `too_big` on a string | `validation.errors.too-short` / `validation.errors.too-long` |
| `too_small` / `too_big` on a number or a bigint, `not_multiple_of` | `validation.errors.out-of-range` |
| `too_small` / `too_big` on a list or a set | `validation.errors.too-few` / `validation.errors.too-many` |
| `invalid_format` (a format such as `email`, or a `pattern`) | `validation.errors.invalid-format` |
| `invalid_format` for `startsWith`, `endsWith` or `includes` | `validation.errors.invalid` |
| any other constraint (a date's bound, a refinement, …) | `validation.errors.invalid` |

A field has no `params`: the bound or the format is not written. These codes
are the ones the API the mocks stand in for answers; a new param would be an
addition, a changed code a breaking change. The mapping is
`@nxgt/graphql-validation`'s `fieldIssueOf`, so a server that answers its own
Zod parses with it answers the same fields.

Each field's path starts at the variable's name, since the handler parses
the variables: `inputPath` drops a leading `input` only. It matches the
server's `inputPath(['input', …])` when the variable is named `input`, after
the argument (`mutation SignUp($input: SignUpInput!) { signUp(input:
$input) }`); a variable named otherwise (`$person`) keeps its name
(`person.firstName`), where the server's path would not.

```json
{
  "errors": [{
    "message": "validation.errors.invalid-input",
    "extensions": {
      "code": "validation.errors.invalid-input",
      "fields": [
        { "path": "person.firstName", "code": "validation.errors.too-short", "message": "validation.errors.too-short" },
        { "path": "person.email", "code": "validation.errors.invalid-format", "message": "validation.errors.invalid-format" },
        { "path": "tags", "code": "validation.errors.too-many", "message": "validation.errors.too-many" }
      ]
    }
  }]
}
```

The status is 400. `fieldIssueOf(issue)` is the mapping above, re-exported
from `./runtime` for a function of your own that keeps it.

#### `translate`

```ts
config: { …, translate: '../i18n#translate' }
```

```ts
// src/i18n.ts
import type { Translate } from '@nxgt/graphql-codegen-msw/runtime';

export const translate: Translate = (code) => messages[code] ?? code;
```

The generated file writes `invalidInputRefusal({ translate })`: the error's
message is `translate('validation.errors.invalid-input')`, each field's
`translate(code)`. `translate` goes with the default answer only; with
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

`issues` are Zod's, each `path` starting with the variable's name, and only
the issues graphql lets through: a value the API refuses while coercing the
variables is answered before your function is called. The handler answers
`{ errors: [error] }` at `status`, as `errorResponse` does: a `GraphQLError`
is written through its `toJSON()`, `extensions.http` left out, and a status no
response can carry (outside 200–599, or 204, 205, 304) is ignored for the
error's own `extensions.http.status`, else 200.

```ts
// src/mocks/invalid-input.ts
import {
	fieldIssueOf,
	type InvalidInput,
	invalidInputError,
} from '@nxgt/graphql-codegen-msw/runtime';
import { translate } from '../i18n';

/** The default shape, with the bound as a param on a string's length. */
export const invalidInput: InvalidInput = (issues) => ({
	error: invalidInputError(
		issues.map((issue) => {
			const field = fieldIssueOf(issue);
			return issue.code === 'too_small' && issue.origin === 'string'
				? { ...field, params: { min: Number(issue.minimum) } }
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
imports `msw`, `msw/graphql`, `graphql` (to locate the coercion answer's
errors in the query sent), `zod` and `@nxgt/graphql-validation` at run time, never
the plugin.

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
	readonly variableTypes?: Readonly<Record<string, string>>; // internal: { first: "Int = 10" }; default {}
	readonly inputTypes?: InputTypes; // internal: the input types the variables reach; default {}
	readonly endpoint: Path;
	readonly invalidInput: InvalidInput;
}

interface MockOptions extends RequestHandlerOptions { // msw's: `once`
	readonly endpoint?: Path;
}

declare function invalidInputRefusal(options?: { readonly translate?: Translate }): InvalidInput;
declare const badUserInputRefusal: InvalidInput;
declare function errorResponse(
	error: AnyGraphQLError | readonly AnyGraphQLError[],
	init?: { readonly status?: number },
): HttpResponse<{ errors: GraphQLFormattedError[] }>;
declare function isGraphQLError(value: unknown): value is GraphQLError;

// Re-exported from @nxgt/graphql-validation, as they are there:
// invalidInputError, fieldsError, fieldIssueOf, inputPath,
// and the types Translate, FieldIssue, FieldError.
declare function fieldIssueOf(issue: z.core.$ZodIssue): FieldIssue;
declare function inputPath(path: readonly PropertyKey[]): string;
```

Types: `GraphQLMockResolver`, `GraphQLMockInfo`, `MockedOperation`,
`MockOptions`, `InvalidInput`, `InvalidInputAnswer`, `RefusedOperation`,
`AnyGraphQLError`, `Translate`, `FieldIssue`, `FieldError`, and `InputTypes` / `InputType`, internal: exported for the
generated file's annotation, their shape may change in any version.

### A handler written by hand

`mockOperation` is the generated handlers' only call: you can write a handler
the plugin does not, for an operation outside your documents, with it.
`variableTypes` and `inputTypes` are optional and default to `{}`: without
them no variable is walked, so every refusal, a value graphql would refuse
while coercing it included, goes to `invalidInput`.

```ts
import { HttpResponse } from 'msw';
import { invalidInputRefusal, mockOperation } from '@nxgt/graphql-codegen-msw/runtime';
import { z } from 'zod';

export const mockPing = mockOperation<{ ping: string }, { times?: number | null }>(
	{
		type: 'query',
		name: 'Ping',
		variables: z.object({ times: z.int().nullish() }),
		endpoint: '*/graphql',
		invalidInput: invalidInputRefusal(),
	},
	() => HttpResponse.json({ data: { ping: 'pong' } }),
);
```

To have the coercion answer as well, copy both from a generated file and
regenerate that file after each upgrade: their shape is internal, and a
`kind` the installed runtime does not know throws
[`the generated file was written by another version than the runtime; regenerate it`](../troubleshooting.md#at-run-time).

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
