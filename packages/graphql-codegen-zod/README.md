# @nxgt/graphql-codegen-zod

A [graphql-codegen](https://the-guild.dev/graphql/codegen) plugin that writes
Zod 4 schemas, and their TypeScript types, from your SDL: one per enum and per
input type, one per field that takes arguments, one per named operation's
variables. It carries every `@constraint` of
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

Declare `@constraint` in the schema codegen reads, with `constraintTypeDefs`
or the `.graphqls` file that package ships. Without the directive nothing is
constrained; plain types are still generated.

Then add the plugin, writing to **its own file**:

```ts
// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
	schema: 'src/schema/**/*.graphql',
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
plugin's.

`scalarSchemas` supplies a Zod schema for each custom scalar of the schema;
see [Scalars](docs/guide/output.md#scalars).

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

What is generated, how it is named, defaults, recursion, `@oneOf` and scalars
are in [Output](docs/guide/output.md).

## Options

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `scalarSchemas` | `string` | none | module exporting a `scalarSchemas` record keyed by scalar name |
| `scalars` | `Record<string, string>` | none | `'<module>#<export>'` per scalar; wins over `scalarSchemas` |
| `schemaPrefix` | `string` | `'z'` | before each schema's name |
| `namingConvention` | `'keep' \| 'change-case-all#<case>' \| (name) => string \| { typeNames, transformUnderscore, enumValues }` | PascalCase per underscore part | how type names are cased, as the typescript plugins read it |
| `typesPrefix`, `typesSuffix` | `string` | none | around each type's name |
| `addUnderscoreToArgsType` | `boolean` | `false` | `Query_FindUserArgs` |
| `dedupeOperationSuffix`, `omitOperationSuffix` | `boolean` | `false` | as in `typescript-operations` |

Each is detailed in [Output](docs/guide/output.md).

## Traps

- An `ID` is a string on the client: `graphql` also takes an `Int` for an
  `ID`, the generated schema does not. Send `{ id: "5" }`.
- A single value for a list of scalars or enums is taken, as `graphql` takes
  it (`tags: "a"` parses to `["a"]`). For a list of input objects, send a
  list.
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

Every error and its fix is in [Troubleshooting](docs/troubleshooting.md).

## Documentation

The package exports `plugin` and the `CodegenZodConfig` type from `.`; graphql-codegen finds `plugin` by the package name. See [Output](docs/guide/output.md#the-plugin-function).

- [Documentation index](docs/README.md)
- Guides: [Output](docs/guide/output.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
