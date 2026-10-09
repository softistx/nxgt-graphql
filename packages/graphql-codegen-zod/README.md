# @nxgt/graphql-codegen-zod

A [graphql-codegen](https://the-guild.dev/graphql/codegen) plugin that writes
Zod 4 schemas, and their TypeScript types, from your SDL: one per enum and per
input type, one per field that takes arguments, one per named operation's
variables, one per object type, interface and union, and one per named
operation's result and per fragment. It carries every `@constraint` of
[`@nxgt/graphql-validation`](https://www.npmjs.com/package/@nxgt/graphql-validation),
through that package's own rules, so the server (`withValidation`) and the
generated code accept and refuse the same values. For graphql-codegen 5 to 7
(ESM) and `graphql` 16 and 17.

## Install

```sh
bun add -d @nxgt/graphql-codegen-zod @graphql-codegen/cli
bun add graphql zod typescript
```

Peers, all **required**:

| Peer | Range |
| --- | --- |
| `graphql` | `^16.11.0 \|\| ^17.0.0` |
| `zod` | `>=4.6.5 <5` |
| `typescript` | `^6.0.3` |

`@nxgt/graphql-validation` is a dependency; you install it yourself only to
run `withValidation` on a server.

## Setup

Write the SDL files codegen reads: `@constraint` from
`@nxgt/graphql-validation` and the custom scalars from `@nxgt/graphql-scalars`.
Install both, so their bins are yours, whatever the package manager links:
`bun add @nxgt/graphql-validation @nxgt/graphql-scalars` (the generated file
imports `@nxgt/graphql-scalars` at run time anyway). Without the directive
nothing is constrained; plain types are still generated.

```sh
bunx nxgt-graphql-validation typedefs --out   # generated/graphql/constraint.graphqls
bunx nxgt-graphql-scalars typedefs --out      # generated/graphql/scalars.graphqls
```

Both bins are described in the
[validation](https://www.npmjs.com/package/@nxgt/graphql-validation#ide-support)
and [scalars](https://www.npmjs.com/package/@nxgt/graphql-scalars#the-sdl-as-a-file)
READMEs. `typedefs DateTime Long --out` keeps only the scalars you use. Or skip the CLI and list
`node_modules/@nxgt/graphql-validation/graphql/constraint.graphqls` and
`node_modules/@nxgt/graphql-scalars/graphql/scalars.graphqls` in `schema`.

Then add the plugin, writing to **its own file**, with those files in `schema`:

```ts
// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
	schema: [
		'generated/graphql/constraint.graphqls',
		'generated/graphql/scalars.graphqls',
		'src/schema/**/*.graphql',
	],
	documents: 'src/operations/**/*.graphql',
	generates: {
		'src/generated/zod.ts': {
			plugins: ['@nxgt/graphql-codegen-zod'],
			config: { scalarSchemas: '@nxgt/graphql-scalars' },
		},
	},
};
export default config;
```

The plugin writes types named as `@graphql-codegen/typescript` names them
(`SignUpInput`, `MutationSignUpArgs`), which would collide with that plugin's
in one file. Its `*Args` and `*Variables` types can replace the typescript
plugin's; so can its object types, interfaces and unions (`User`), or
`objects: false` leaves them to that plugin. Its `*Query`, `*Mutation` and
`*Fragment` types can replace typescript-operations' (`SearchQuery`,
`UserFieldsFragment`), or `operations: false` leaves them to it.

`scalarSchemas` supplies a Zod schema for each custom scalar of the schema;
see [Scalars](docs/guide/output.md#scalars).

Run codegen, once or on every change:

```sh
bunx graphql-codegen --config codegen.ts
bunx graphql-codegen --config codegen.ts --watch
```

or add `"codegen": "graphql-codegen"` to the `scripts` of `package.json` and
run `bun run codegen`.

## Usage

### On the server: type the resolvers

Arguments are typed `z.output`: what a resolver receives once
`withValidation` has parsed them.

```ts
import type { MutationSignUpArgs } from './generated/zod';

export const signUp = (_: unknown, { input }: MutationSignUpArgs) => {
	// input.role is always set: its default was filled in
	return { id: 'u_1', email: input.email };
};
```

### On the server: type what a resolver returns

Object types, interfaces and unions are typed
`z.output`: custom scalars decoded, `__typename` optional, nullable fields
optional.

```ts
import type { User } from './generated/zod';

export const me = (): User => ({ id: 'u_1', name: 'Al', joined: new Date() });
```

`zUser.parse(value)` checks a whole object: it decodes custom scalars and
drops a field the schema does not declare.

### On the client: check before sending

Variables are typed `z.input`: what a client sends. A schema per named
operation accepts and refuses what the server would.

```ts
import { zSignUpMutationVariables } from './generated/zod';

const result = zSignUpMutationVariables.safeParse({
	input: { email: form.email, name: form.name },
});
if (!result.success) {
	for (const issue of result.error.issues) showError(issue.path, issue.message);
}
```

### On the client: parse the response

An operation's result is typed `z.output`: what the response holds, custom
scalars decoded. An abstract type's selection is a union on `__typename` when
its members select different fields, so checking it narrows.

```graphql
query Search($text: String!) {
  search(text: $text) {
    __typename
    ... on User { id joined }
    ... on Post { id title }
  }
}
```

```ts
import { zSearchQuery } from './generated/zod';

const search = zSearchQuery.parse(response.data).search;
for (const hit of search) {
	if (hit.__typename === 'User') hit.joined.getFullYear(); // a Date
	else hit.title; // Post
}
```

What is generated, how it is named, defaults, recursion, `@oneOf` and scalars
are in [Output](docs/guide/output.md).

## Options

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `scalarSchemas` | `string` | none | module exporting a `scalarSchemas` record keyed by scalar name |
| `zodScalars` | `Record<string, string>` | none | `'<module>#<export>'` per scalar; wins over `scalarSchemas` |
| `schemaPrefix` | `string` | `'z'` | before each schema's name |
| `namingConvention` | `'keep' \| 'change-case-all#<case>' \| (name) => string \| { typeNames, transformUnderscore, enumValues }` | PascalCase per underscore part | how type names are cased, as the typescript plugins read it |
| `typesPrefix`, `typesSuffix` | `string` | none | around each type's name |
| `addUnderscoreToArgsType` | `boolean` | `false` | `Query_FindUserArgs` |
| `dedupeOperationSuffix`, `omitOperationSuffix` | `boolean` | `false` | as in `typescript-operations` |
| `objects` | `boolean` | `true` | write the object types, interfaces and unions; `false` writes the input side only |
| `operations` | `boolean` | `true` | write each named operation's result and each fragment; `false` writes none, the variables stay |

Each is detailed in [Output](docs/guide/output.md).

## Traps

- An `ID` is a string on the client: `graphql` also takes an `Int` for an
  `ID`, the generated schema does not. Send `{ id: "5" }`.
- A single value for a list is taken, as `graphql` takes it, for every item
  type and at any depth: `tags: "a"` parses to `["a"]`, `contacts: { phone }`
  to `[{ phone }]`.
- An input type in a cycle (`Filter.and: [Filter]`) has its types written
  out, `Filter` and `FilterInput`, and its schema is typed
  `z.ZodType<Filter, FilterInput>`: it has no `.shape` or `.extend`.
- Input types are `z.strictObject`: a field the schema does not declare is
  refused.
- A schema that declares `@constraint` must come from SDL files; an
  introspected one fails generation.
- The plugin refuses a schema `withValidation` would refuse, with the same
  message; those are in the
  [validation troubleshooting](https://github.com/softistx/nxgt-graphql/blob/develop/packages/graphql-validation/docs/troubleshooting.md).
- A custom scalar mapped nowhere fails generation, naming it, rather than
  becoming an unchecked `z.unknown()`.
- Generate into a file of its own: the type names collide with the typescript
  plugins'.
- An abstract type whose possible types select different fields is a union on
  `__typename`: select it, under one key for every member, or generation
  fails. When they all select the same fields, no `__typename` is needed.
- A field under `@skip`, `@include` or `@defer` may be absent: it is
  `.optional()`.
- Generate into a file of its own: a `*Query` or `*Fragment` type collides with
  typescript-operations'. Take them from this plugin, or set `operations: false`.
- An input type in a cycle also declares `<Type>Input`: a GraphQL type of
  that name fails generation. Rename it, or set `typesSuffix`.

Every error and its fix is in [Troubleshooting](docs/troubleshooting.md).

## Documentation

The package exports `plugin` and the `CodegenZodConfig` and `DocumentFile` types from `.`; graphql-codegen finds `plugin` by the package name. See [Output](docs/guide/output.md#the-plugin-function).

- [Documentation index](docs/README.md)
- Guides: [Output](docs/guide/output.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
