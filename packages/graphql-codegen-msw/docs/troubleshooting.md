# Troubleshooting

One entry per error you can hit, headed by the message you will search for.
Configuration and Operations happen while `graphql-codegen` runs; The
generated file is what `tsc` reports; At run time is what a handler throws
or answers.

- [Configuration](#configuration)
- [Operations](#operations)
- [The generated file](#the-generated-file)
- [At run time](#at-run-time)

## Configuration

### `@nxgt/graphql-codegen-msw: endpoint is not set; set it to the URL your client sends its operations to, e.g. endpoint: 'https://api.example.com/graphql', or a path msw matches on any origin: '*/graphql'.`

**When:** running codegen without `endpoint`, or with an empty one.
**Why:** every handler is built on msw's `graphql.link(endpoint)`, and the
plugin does not guess where your client sends its operations.
**Fix:** set it; a handler can still answer elsewhere through
`options.endpoint`.

```ts
config: { endpoint: 'https://api.example.com/graphql', schemasImport: './zod', typesImport: './graphql' }
```

### `@nxgt/graphql-codegen-msw: schemasImport is not set; point it at the file @nxgt/graphql-codegen-zod writes, as this file imports it, e.g. schemasImport: './zod'.`

**When:** running codegen without `schemasImport`.
**Why:** each handler checks its variables with codegen-zod's
`z<Operation>Variables`; without it the mock would take any input.
**Fix:** generate codegen-zod's file and point the option at it, relative to
the generated file.

```ts
generates: {
	'src/generated/zod.ts': { plugins: ['@nxgt/graphql-codegen-zod'] },
	'src/generated/msw.ts': {
		plugins: ['@nxgt/graphql-codegen-msw'],
		config: { endpoint: '*/graphql', schemasImport: './zod', typesImport: './graphql' },
	},
},
```

### `@nxgt/graphql-codegen-msw: typesImport is not set; point it at the module that exports each operation's result and variables types, as this file imports it: './graphql' for the client preset, or the file typescript-operations writes.`

**When:** running codegen without `typesImport`.
**Why:** each handler's resolver is typed with the operation's result and
variables types, which the plugin imports rather than writes.
**Fix:** point it at the client preset's `graphql.ts` or
`typescript-operations`' file, relative to the generated file.

```ts
config: { endpoint: '*/graphql', schemasImport: './zod', typesImport: './graphql' }
```

### `@nxgt/graphql-codegen-msw: invalidInput is "invalidInput"; write 'invalid-input', 'bad-user-input' or '<module>#<export>', e.g. './invalid-input#invalidInput'.`

**When:** running codegen with an `invalidInput` that is neither of the two
answers the plugin knows nor a `module#export`. The value in the message is
the one you wrote.
**Why:** a module needs an export name after the last `#`, and the plugin
does not guess it.
**Fix:**

```ts
config: { …, invalidInput: '../mocks/invalid-input#invalidInput' }
```

### `@nxgt/graphql-codegen-msw: translate is "./i18n"; write '<module>#<export>', e.g. './i18n#translate'.`

**When:** running codegen with a `translate` that is not `module#export`.
**Why:** the generated file imports one export of that module.
**Fix:**

```ts
config: { …, translate: '../i18n#translate' }
```

### `@nxgt/graphql-codegen-msw: translate words the default invalidInput's messages only, and invalidInput is "bad-user-input". Remove translate, or translate inside your own function.`

**When:** running codegen with `translate` beside `invalidInput:
'bad-user-input'` or a function of yours.
**Why:** `translate` is handed to `invalidInputRefusal`, the default answer.
`BAD_USER_INPUT` carries Zod's messages, and your function words its own.
**Fix:** remove `translate`, or call your translator inside your function.

```ts
export const invalidInput: InvalidInput = (issues) => ({
	error: invalidInputError(issues.map(fieldIssueOf), { translate }),
	status: 400,
});
```

### `@nxgt/graphql-codegen-msw: namingConvention "my-module#myCase" is not one this plugin reads. Use 'keep', a function, or 'change-case-all#<case>' with one of camelCase, capitalCase, constantCase, dotCase, headerCase, noCase, paramCase, pascalCase, pathCase, sentenceCase, snakeCase, lowerCase, upperCase, lowerCaseFirst, upperCaseFirst.`

**When:** running codegen with a `namingConvention` string that names
another module, or a case not in the list.
**Why:** the plugin reads the forms the typescript plugins take for type
names, but only `change-case-all` and `change-case` cases; it does not load a
module.
**Fix:** use one of the forms, or pass a function. Set it at the root of the
codegen config, so the types, the schemas and the handlers agree.

```ts
config: { namingConvention: 'change-case-all#pascalCase' }
```

## Operations

### `@nxgt/graphql-codegen-msw: the file would declare mockGetUserQuery twice: two operations give it the same name. Rename one of them.`

**When:** running codegen on documents with two operations whose names
convert to one (`getUser` and `GetUser`, or `UserQuery` and `User` under
`dedupeOperationSuffix`).
**Why:** each handler is named after its operation's converted name; two
would collide, as their types do in the typescript plugins' files.
**Fix:** rename one operation.

### No handler for an operation

**When:** an operation is in the documents, but the generated file has no
`mock…` for it.
**Why:** it is anonymous (msw matches by name), or a subscription (msw 3 mocks
subscriptions over WebSocket only; see the [roadmap](roadmap.md)).
**Fix:** name the operation. For a subscription, use msw's own
`graphql.link(endpoint).subscription(name, resolver)`.

## The generated file

### `TS2305: Module '"./graphql"' has no exported member 'UserQuery'`

**When:** typechecking the generated file, with a type name in the message.
**Why:** `typesImport` points at a module that names its types otherwise:
another naming option (`typesPrefix`, `omitOperationSuffix`, …) is set on
that output only, or the module is not the operations' types.
**Fix:** point `typesImport` at the client preset's `graphql.ts` or
`typescript-operations`' file, and move the naming options to the root
`config` of `codegen.ts`, so every output reads them.

### `TS2305: Module '"./zod"' has no exported member 'zUserQueryVariables'`

**When:** typechecking the generated file.
**Why:** `schemasImport` points at a file that is not codegen-zod's, or
codegen-zod's output names its schemas otherwise (`schemaPrefix` or a naming
option set on one output only).
**Fix:** point `schemasImport` at codegen-zod's file and set the naming
options, `schemaPrefix` included, at the root `config`.

### `TS2835: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './zod.js'?`

**When:** typechecking the generated file under `moduleResolution:
nodenext` or `node16`.
**Why:** the plugin writes each module as you configured it.
**Fix:** give each relative module its `.js` extension: `schemasImport:
'./zod.js'`, `typesImport: './graphql.js'`, `invalidInput:
'../mocks/invalid-input.js#invalidInput'`.

### `Type '(issues: …) => …' is not assignable to type 'InvalidInput'`

**When:** typechecking the generated file, at `export const invalidInput:
InvalidInput = …`.
**Why:** the function `invalidInput` names does not take `(issues,
operation)` or does not return `{ error, status }`.
**Fix:** type it with `InvalidInput`, so the error shows in your module.

```ts
import type { InvalidInput } from '@nxgt/graphql-codegen-msw/runtime';

export const invalidInput: InvalidInput = (issues) => ({
	error: { message: 'Invalid input' },
	status: 400,
});
```

### `Object literal may only specify known properties, and 'nickname' does not exist in type …`

**When:** typechecking a resolver whose `data` holds a field the operation
does not select.
**Why:** `data` is typed with the operation's result type.
**Fix:** answer what the operation selects, or add the field to the
operation.

## At run time

### `@nxgt/graphql-codegen-msw: the resolver of User returned an iterator (a generator function?). Each request's variables are checked before the resolver runs, which msw cannot do once it keeps an iterator: answer each request from a plain function, or register one handler per answer with { once: true }.`

**When:** a request reaches a handler whose resolver is a generator function
(the resolver's type refuses one; a cast lets it through). msw answers that
request with a 500.
**Why:** msw keeps a generator's iterator and answers the next requests from
it without calling the handler again, so their variables would go unchecked.
**Fix:** one handler per answer, in the order they should answer:

```ts
server.use(
	mockUserQuery(() => HttpResponse.json({ data: { user: first } }), { once: true }),
	mockUserQuery(() => HttpResponse.json({ data: { user: second } })),
);
```

### `@nxgt/graphql-codegen-msw: the generated file was written by another version than the runtime; regenerate it`

**When:** a request reaches a handler whose generated file describes an input
type in a form this version of the runtime does not read (its `inputTypes`
entry has a `kind` the runtime does not know). msw answers that request with
a 500.
**Why:** `inputTypes` and `variableTypes` are an internal shape, written by
the plugin and read by the runtime of the same version; the file was
generated by another version of `@nxgt/graphql-codegen-msw` than the one
installed.
**Fix:** regenerate the file with the installed version:

```sh
bunx graphql-codegen
```

A handler you write yourself with `mockOperation` can leave `variableTypes`
and `inputTypes` out: no variable is then walked, and every refusal goes to
`invalidInput`.

### A request goes to the network under Bun: `getaddrinfo ENOTFOUND api.example.com`

**When:** a test under `bun test` uses msw/node's `setupServer`.
**Why:** `setupServer` intercepts no request under Bun (msw 3.0.3, Bun
1.4.2): its `fetch` interceptor works through Node's sockets, which Bun's
`fetch` does not use.
**Fix:** run that test under Node, or build msw's network on the web `fetch`
interceptor, as in [Under Bun](guide/handlers.md#under-bun).

### Every request answers 400 `validation.errors.invalid-input`

**When:** a handler refuses variables the server takes.
**Why:** a constraint of the variables' schema refuses them;
`extensions.fields` says where, each field's `code` which kind of rule
(`too-short`, `out-of-range`, `invalid-format`, …).
**Fix:** send what the schema takes; the field's `path` and `code` name the
rule that refused. One case the server takes: an integer for an `ID`
(codegen-zod takes an `ID` as a string only, where GraphQL also takes an
integer), answered `validation.errors.invalid`; send the `ID` as a string:
`{ id: String(user.id) }`.

### An invalid input answers 200 `BAD_USER_INPUT` with no `data`

**When:** the generated file is written with `invalidInput: 'bad-user-input'`,
and a test expects a 4xx status, or a `data` key beside the error.
**Why:** this answer stands for the error `withValidation` raises inside a
resolver: a GraphQL server answers a resolver's error with status 200. The
mock answers `{ errors: [error] }` alone, without the `data` (and the error's
`path` and `locations`) the server's execution adds, since no resolver runs.
**Fix:** expect status 200 and read the error, not the status:

```ts
const response = await fetch(endpoint, { method: 'POST', headers, body });
expect(response.status).toBe(200);
const { errors } = await response.json();
expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
```

For an API that answers invalid input with a 400, generate with the default
`invalidInput` (`'invalid-input'`) or your own function, which returns its
status.

### A request answers 400 `Variable "$id" got invalid value true; ID cannot represent value: true`

**When:** the variables hold a value the API refuses while coercing them: a
missing or `null` value for a non-null type, a value of the wrong type, an
unknown enum value, an input field the type does not declare, an `Int`
beyond 32 bits, a value a custom scalar refuses.
**Why:** graphql-yoga refuses these before any resolver or validation runs,
with one plain error per problem and status 400; the mock answers the same,
in graphql 17's words, whatever `invalidInput` is.
**Fix:** send what the variable's type takes; the message names the type and,
for an enum value or an input field, graphql's closest match (`Did you mean
"tags"?`).

```ts
await client.query(UserDocument, { id: String(user.id) });
```

### A message differs from the API's after an upgrade

**When:** the coercion answer names a type, or a field, the schema no longer
has.
**Why:** the generated file describes the input types from the schema at
generation time (`inputTypes`, `variableTypes`); they go stale with the
schema, and their shape may change with this package.
**Fix:** regenerate the file after a schema change and after upgrading
`@nxgt/graphql-codegen-msw`.

### The resolver's error answers 500

**When:** the resolver throws something that is not a `GraphQLError`.
**Why:** only a `GraphQLError` (any copy of `graphql`, recognised by its name
and `toJSON`) is answered as a GraphQL error; anything else is msw's, which
answers 500.
**Fix:** throw a `GraphQLError`, or return `errorResponse(...)`.
