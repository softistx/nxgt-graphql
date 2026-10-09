# Output

What the plugin writes from your schema and operations: the schemas, the
types, their names, and how defaults, recursion, `@oneOf`, custom scalars,
output types and operation results come out.

## The smallest example

The SDL files for `@constraint` and the scalars, and how to run codegen, are in
the README's [Setup](../../README.md#setup).

```graphql
# schema
input SignUpInput {
  email: String! @constraint(format: "email")
  name: String! @constraint(minLength: 2)
  age: Int @constraint(min: 13, max: 120)
  role: Role = USER
}
enum Role { ADMIN USER }
type Mutation { signUp(input: SignUpInput!): Boolean }
```

```graphql
# a document
mutation SignUp($input: SignUpInput!) { signUp(input: $input) }
```

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

The plugin writes, in this order: every enum, every input type, the
arguments of every object or interface field that takes any, every object
type, then every interface and union (see [Output types](#output-types)),
then the variables of every named operation. The results come last: every
fragment's, then every named operation's (see
[Operation results](#operation-results)). Each is a schema and its type.

```ts
import { z } from "zod";

export const zRole = z.enum(["ADMIN", "USER"]);
export type Role = z.output<typeof zRole>;

export const zSignUpInput = z.strictObject({
	email: z.email(),
	name: z.string().min(2),
	age: z.int32().lte(120).gte(13).nullish(),
	role: zRole.prefault("USER").nullable(),
});
export type SignUpInput = z.output<typeof zSignUpInput>;

export const zMutationSignUpArgs = z.object({
	get input() {
		return zSignUpInput;
	},
});
export type MutationSignUpArgs = z.output<typeof zMutationSignUpArgs>;

export const zMutation = z.object({
	__typename: z.literal("Mutation").optional(),
	signUp: z.boolean().nullish(),
});
export type Mutation = z.output<typeof zMutation>;

export const zSignUpMutationVariables = z.object({
	get input() {
		return zSignUpInput;
	},
});
export type SignUpMutationVariables = z.input<typeof zSignUpMutationVariables>;
```

The file imports only `zod` and the modules of your scalar schemas. Every
string in it is double-quoted. An input type is a `z.strictObject`: a field
the schema does not declare is refused, as `graphql` refuses it. The
arguments and variables objects stay `z.object`, because `graphql` ignores an
extra argument or variable.

A GraphQL description becomes a doc comment on the schema and its type, and on
each argument and input field that has one (line endings are normalised, so a
CRLF description gives the same comment). Every other import takes a name the
file does not declare: a clash is aliased, `money as money2`.

```ts
export const zQueryUserArgs = z.object({
	/** At least three characters. */
	id: z.string().min(3),
});
```

## What each part is for

| Generated | From | Typed | Use it for |
| --- | --- | --- | --- |
| `z<Enum>` | an `enum` | `z.output` | `z.enum([...])` |
| `z<Input>` | an `input` | `z.output` | the value a resolver receives |
| `z<Parent><Field>Args` | an object or interface field with arguments | `z.output` | typing the resolver's arguments |
| `z<Operation><Kind>Variables` | a named operation in `documents` | `z.input` | checking a form before sending it |
| `z<Type>` | an object type, interface or union | `z.output` | typing or checking what a resolver returns |
| `z<Operation><Kind>` | a named operation in `documents` | `z.output` | parsing the response on the client |
| `z<Fragment>Fragment` | a fragment in `documents` | `z.output` | parsing the part of a response a fragment selects |

`z.output` is what a resolver receives after `withValidation` parsed the
arguments; `z.input` is what a client sends. They differ where a default
applies, see [Defaults](#defaults).

### On the server

```ts
import type { MutationSignUpArgs } from './generated/zod';

export const signUp = (_: unknown, { input }: MutationSignUpArgs) =>
	input.role === 'ADMIN'; // typed: 'ADMIN' | 'USER' | null
```

### On the client

```ts
import { zSignUpMutationVariables } from './generated/zod';

const parsed = zSignUpMutationVariables.safeParse({
	input: { email: 'nope', name: 'A' },
});
// parsed.success === false; parsed.error.issues lists the email and the name
```

The schema is the same rule the server applies: a spec in this package
checks, operation by operation, that the client schema accepts exactly what
the server accepts.

## Naming

Schemas are prefixed `z`; types keep the names `@graphql-codegen/typescript`
and `typescript-operations` give them.

| What | Schema | Type |
| --- | --- | --- |
| input | `zSignUpInput` | `SignUpInput` |
| enum | `zRole` | `Role` |
| field arguments | `zMutationSignUpArgs` | `MutationSignUpArgs` |
| operation variables | `zSignUpMutationVariables` | `SignUpMutationVariables` |
| object type, interface, union | `zUser` | `User` |
| operation result | `zSearchQuery` | `SearchQuery` |
| fragment | `zUserFieldsFragment` | `UserFieldsFragment` |

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `schemaPrefix` | `string` | `'z'` | before each schema's name: `schemaPrefix: 'schema'` gives `schemaSignUpInput` |
| `namingConvention` | `'keep' \| 'change-case-all#<case>' \| (name: string) => string \| { typeNames, transformUnderscore, enumValues }` | PascalCase each part between underscores | how type names are cased, see below |
| `typesPrefix` | `string` | `''` | before each type's name: `ISignUpInput`; the schema's name follows: `zISignUpInput` |
| `typesSuffix` | `string` | `''` | after each type's name |
| `addUnderscoreToArgsType` | `boolean` | `false` | `Query_FindUserArgs` instead of `QueryFindUserArgs` |
| `dedupeOperationSuffix` | `boolean` | `false` | `findUserQuery` gives `FindUserQueryVariables` and `FindUserQuery`, not `FindUserQueryQueryVariables` and `FindUserQueryQuery`; a fragment `UFFragment` gives `UfFragment` |
| `omitOperationSuffix` | `boolean` | `false` | `FindUserVariables`, `FindUser`: no `Query`, `Mutation`, `Subscription` or `Fragment` |

```ts
config: {
	namingConvention: 'keep',
	typesPrefix: 'I',
	addUnderscoreToArgsType: true,
}
// type IQuery_find_userArgs, schema zIQuery_find_userArgs
```

`namingConvention` takes every form the typescript plugins take for type
names:

| Form | Effect |
| --- | --- |
| `'keep'` | names as written |
| `'change-case-all#<case>'` or `'change-case#<case>'` | the case applied to each part between underscores. change-case-all's `<case>`: `camelCase`, `capitalCase`, `constantCase`, `dotCase`, `headerCase`, `noCase`, `paramCase`, `pascalCase`, `pathCase`, `sentenceCase`, `snakeCase`, `lowerCase`, `upperCase`, `lowerCaseFirst`, `upperCaseFirst`; change-case 5's names (`kebabCase`, `trainCase`, `pascalSnakeCase`, …) after `change-case#` |
| `(name) => string` | the function applied to each part between underscores |
| `{ typeNames, transformUnderscore, enumValues }` | with `typeNames` (a case or a function) the case applies to the whole name, underscores included, whatever `transformUnderscore` says, as in the typescript plugins; `'keep'` keeps it. Without `typeNames`: PascalCase each part, or the whole name with `transformUnderscore: true`. `enumValues` is ignored: enum values are written as they are |

```ts
config: { namingConvention: 'change-case-all#camelCase' }
config: { namingConvention: { transformUnderscore: true } } // sign_upInput → SignUpInput
```

Any other module string (`'my-module#myCase'`) throws, see
[Troubleshooting](../troubleshooting.md).

### One file of its own

Generate into a file the typescript plugins do not write to: the names would
collide. This plugin's types can replace the typescript plugin's `*Args` and
`*Variables`, and typescript-operations' `*Query`, `*Mutation` and `*Fragment`,
so the other plugins can be limited to the output types. Or set
`operations: false`, and keep those from typescript-operations.

## Defaults

A default value becomes `.prefault(<default>)`, then `.nullable()` when the
type is nullable. The key is optional on the way in and always present on the
way out, as `graphql` fills it.

```graphql
input SignUpInput {
  role: Role = USER
  tags: [String!] = "new" @constraint(minItems: 1)
}
type Query { users(first: Int = 10 @constraint(min: 1, max: 50)): [String!]! }
```

```ts
export const zSignUpInput = z.strictObject({
	role: zRole.prefault("USER").nullable(),
	tags: z.union([z.array(z.string()).min(1), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string()).min(1))]).prefault(["new"]).nullable(),
});
export const zQueryUsersArgs = z.object({
	first: z.int32().lte(50).gte(1).prefault(10).nullable(),
});
```

```ts
import { zQueryUsersArgs, type QueryUsersArgs, type SignUpMutationVariables } from './generated/zod';

zQueryUsersArgs.parse({}); // { first: 10 }

const first: QueryUsersArgs['first'] = 10; // number | null: always present
const sent: SignUpMutationVariables = { input: { email: 'a@b.co', name: 'Al' } }; // role may be left out
```

A default is coerced as `graphql` coerces it, at any depth. A single value
given for a list is wrapped, once per level of nesting: `tags: [String!] = "new"`
is `.prefault(["new"])`, and `[[Int]] = 1` is `[[1]]`. This holds inside the
default literal of an input object:

```graphql
input Prefs { tags: [String!], grid: [[Int]] }
input SignUpInput { prefs: Prefs = { tags: "x", grid: 1 } }
```

```ts
get prefs() {
	return zPrefs.prefault({"tags":["x"],"grid":[[1]]}).nullable();
},
```

An integer default past `Number.MAX_SAFE_INTEGER` given to an `ID` or a
custom scalar fails generation, since the server keeps every digit: write
it as a string, `n: Long = "9007199254740993"`.

An `Int` given for an `ID` is its string, as `graphql` makes it: `owner: ID = 7`
is `.prefault("7")`, `ids: [ID!] = 1` is `.prefault(["1"])`.

A schema built without SDL and without `@constraint` keeps its defaults:
introspected ones as their literal, a graphql 17 code-first one through
`valueToLiteral`, a graphql 16 one through `astFromValue`.

## Recursion

An input type that refers to a type declared later is written with a Zod 4
getter, so the order of declaration does not matter. Only a member that
names an input type is a getter; the rest are plain properties.

An input type in a cycle, one that reaches itself through its fields
(`Filter.and: [Filter]`, or `Group` → `Member` → `Group`), cannot have its
type inferred once a field takes a single value for a list. Its types are
written out instead: `Filter`, what the resolver receives, and `FilterInput`,
what a client sends, and the schema is typed by both. The file's typecheck
proves the schema's types fit inside them; the package's type specs pin
them field by field.

```graphql
"""A filter that nests."""
input Filter {
  and: [Filter!] @constraint(maxItems: 3)
  name: String @constraint(startsWith: "n")
}
```

```ts
/** A filter that nests. */
export type Filter = {
	and?: Array<Filter> | null | undefined;
	name?: string | null | undefined;
};
/** A filter that nests. */
export type FilterInput = {
	and?: FilterInput | Array<FilterInput> | null | undefined;
	name?: string | null | undefined;
};
/** A filter that nests. */
export const zFilter: z.ZodType<Filter, FilterInput> = z.strictObject({
	get and() {
		return z.union([z.array(zFilter).max(3), z.custom<z.input<typeof zFilter>>((value) => !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zFilter).max(3))]).nullish();
	},
	name: z.string().startsWith("n").nullish(),
});
```

**Trap:** typed `z.ZodType`, a schema in a cycle has no `.shape`,
`.extend` or `.pick`. Use the types, or rebuild the object you need. A type
outside a cycle keeps its `ZodObject`.

## @oneOf

An input type marked `@oneOf` becomes a `z.union` of `z.strictObject`s, each
holding one member, set.

```graphql
input Contact @oneOf {
  email: String @constraint(format: "email")
  phone: String @constraint(minLength: 6)
}
```

```ts
export const zContact = z.union([
	z.strictObject({
		email: z.email(),
	}),
	z.strictObject({
		phone: z.string().min(6),
	}),
]);
```

```ts
zContact.safeParse({ email: 'a@b.co' }).success; // true
zContact.safeParse({ email: 'a@b.co', phone: '123456' }).success; // false
```

## Variables

A variable takes the constraints of every argument or input field it is
passed to, including inside list and object literals and in the fragments the
operation spreads.

```graphql
query Users($name: String, $first: Int = 5) {
  users(filter: { and: [{ name: $name }] }, first: $first) { id }
}
```

`$name` is passed to `Filter.name`, which `startsWith: "n"`; `$first` to
`first`, which is `min: 1, max: 50`:

```ts
export const zUsersQueryVariables = z.object({
	name: z.string().startsWith("n").nullish(),
	first: z.int32().lte(50).gte(1).prefault(5).nullable(),
});
export type UsersQueryVariables = z.input<typeof zUsersQueryVariables>;
```

- Constraints come only from a variable's direct usages and from list or
  object literals: `rate(ids: [$id])` with `ids: [ID!]! @constraint(minItems: 1, minLength: 3)`
  gives `id: z.string().min(3)`. A variable of a non-list type is never
  passed where a list is expected, so it takes no list rule.
- A variable passed to several places takes the constraints of all of them.
  Two different `format`s cannot both apply, and fail generation, see
  [Troubleshooting](../troubleshooting.md).
- An **anonymous operation gets no schema**: it has no name to give one.
  Name it.
- The variable of a directive's argument (`@include(if: $x)`) carries no
  constraint.

**Coercions.** A list also takes a single value, as `graphql` does, whatever
its items and at any depth (`"a"` for `[[String]]` is `[["a"]]`): the value
is wrapped, then checked as the list. From `Prefs.tags`:

```ts
tags: z.union([z.array(z.string()), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string()))]).nullish(),
```

`zPrefs.parse({ tags: "ok" })` gives `{ tags: ["ok"] }`, what the resolver
receives. A rule refuses a single value as the server does, at the same path:
`SignUpInput.tags` is `[String!] @constraint(minItems: 1, maxLength: 8)`, and
`tags: "toolongtag"` fails at `["input", "tags", 0]` with the server's
message.

A custom scalar's schema may decode (`DateTime`, a string to a `Date`), and
an input object's holds such scalars. For both, the single value reaches the
list's schema as it was sent, and is parsed once:

```ts
dates: z.union([z.array(scalarSchemas.DateTime), z.custom<z.input<typeof scalarSchemas.DateTime>>((value) => !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(scalarSchemas.DateTime))]).nullish(),
```

```ts
get contacts() {
	return z.union([z.array(zContact).max(2), z.custom<z.input<typeof zContact>>((value) => !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zContact).max(2))]).nullish();
},
```

One exception, refused: an `Int` for an `ID`. `graphql` takes it, the schema
is `z.string()`. Send ids as strings.

## Scalars

Built-in scalars are written in full: `String` and `ID` as `z.string()`,
`Int` as `z.int32()` (32-bit, as graphql reads it), `Float` as `z.number()`, `Boolean` as
`z.boolean()`, each with its constraints.

A custom scalar needs a Zod schema from you, mapped in one of two ways:

| Option | Type | Effect |
| --- | --- | --- |
| `scalarSchemas` | `string` | a module exporting a `scalarSchemas` record keyed by GraphQL name; `@nxgt/graphql-scalars` exports one from 0.4.0 |
| `zodScalars` | `Record<string, string>` | `'<module>#<export>'` for one scalar; wins over the record |

```ts
config: {
	scalarSchemas: '@nxgt/graphql-scalars',
	zodScalars: { Money: './money#moneySchema' },
}
```

```ts
// what the generated file imports
import { z } from "zod";
import { scalarSchemas } from "@nxgt/graphql-scalars";
import { moneySchema } from "./money";
```

```ts
birth: scalarSchemas.DateTime.nullish(),
price: moneySchema,
```

- Two exports with the same name from different modules are aliased:
  `import { schema } from "./money"; import { schema as schema2 } from "./cost";`.
- Module paths are written as they are in the generated file, so a relative
  one (`./money`) is relative to **it**, not to `codegen.ts`.
- A custom scalar that is in neither fails generation, naming it. See
  [Troubleshooting](../troubleshooting.md).
- The option is `zodScalars`, not `scalars`: a root `config: { scalars: {
  DateTime: 'Date' } }` written for the typescript plugins reaches this
  plugin too, and is ignored.
- The plugin loads the `scalarSchemas` module to check its keys when it can.
  When it cannot (a `.ts` file under Node), it trusts the record, and the
  generated file then fails to typecheck on a missing key.
- A rule on a custom scalar (`@constraint` on a `DateTime` field) is refused,
  as `withValidation` refuses it; check the value in the scalar's own schema.

## Output types

Every object type gets a schema and a type, typed `z.output`: what a
resolver returns. The root types are written too: a field may return
`Query` (a mutation payload's `query: Query!`). Then every interface and union, as a `z.union` of its
object types. `objects: false` writes none of them.

```graphql
"""Someone with an account."""
type User implements Node {
  id: ID!
  name: String!
  role: Role
  "Who they follow."
  friends: [User!]
  pinned: SearchResult
  joined: DateTime!
}
union SearchResult = User | Post
```

A type outside any cycle is a `z.object`, its type inferred:

```ts
export const zMutation = z.object({
	__typename: z.literal("Mutation").optional(),
	signUp: z.boolean().nullish(),
});
export type Mutation = z.output<typeof zMutation>;

export const zSearchResult = z.union([zUser, zPost]);
export type SearchResult = z.output<typeof zSearchResult>;
```

An interface no object type implements is `z.never()`; a union of one
member is that member's schema.

A type in a cycle (`User.friends: [User!]`, or `User` → `Org` → `User`) has
its types written out, as an input type in a cycle has: TypeScript infers a
looping schema only so deep, and fails with TS2589 on a loop of ten types.
`User` is what a resolver returns, `UserWire` the wire value (not
`UserInput`, which an SDL `input UserInput` often already takes), and `zUser`
is typed by both:

```ts
/** Someone with an account. */
export type User = {
	__typename?: "User" | undefined;
	id: string;
	name: string;
	role?: z.output<typeof zRole> | null | undefined;
	/** Who they follow. */
	friends?: Array<User> | null | undefined;
	pinned?: z.output<typeof zSearchResult> | null | undefined;
	joined: z.output<typeof scalarSchemas.DateTime>;
};
/** Someone with an account. */
export type UserWire = {
	/* the same, with z.input for scalars, UserWire, z.input<typeof zSearchResult> */
};
/** Someone with an account. */
export const zUser: z.ZodType<User, UserWire> = z.object({
	__typename: z.literal("User").optional(),
	id: z.string(),
	name: z.string(),
	role: zRole.nullish(),
	/** Who they follow. */
	get friends() {
		return z.array(zUser).nullish();
	},
	get pinned() {
		return zSearchResult.nullish();
	},
	joined: scalarSchemas.DateTime,
});
```

`zUser` is then a `z.ZodType`, not a `z.ZodObject`: `.shape`, `.pick` and
`.extend` are not offered on a type in a cycle.

- **`__typename` is optional:** a resolver rarely sets it. When it is set, it
  must be the type's name.
- **A field the type does not declare is dropped** (`z.object`): a newer
  server's extra field does not fail a parse.
- **Custom scalars are decoded:** `User['joined']` is a `Date` with
  `@nxgt/graphql-scalars`; `z.input<typeof zUser>` has the wire `string`.
- **Every field is written**, arguments ignored: `User` is the whole type, as
  `@graphql-codegen/typescript` writes it.
- **Nesting goes through getters**, so types refer to each other in any
  order. Interfaces and unions are declared after every object type.
- `Int` is `z.int32()` and `ID` a `z.string()`, as for inputs. A nullable
  field is `.nullish()`.
- **Every custom scalar needs a schema**, an output-only one included
  (`createdAt: DateTime` on an object type): generation fails naming it,
  as for inputs. 0.1.0 did not read output fields; `objects: false` gives
  its output back.
- **A name the plugin already writes clashes:** an object type named
  `QueryFindArgs`, or `FilterInput` beside a cyclic input `Filter`, fails
  generation with "would declare … twice". Rename it, set `typesSuffix`, or
  set `objects: false`.

## Operation results

Each fragment and each named operation gets a schema and a type, typed
`z.output`: the response as it arrives, under the aliases the document gave.
`operations: false` writes none of them; the variables stay. An anonymous
operation gets none, as for variables.

```graphql
query Search($text: String!, $id: ID!, $withTags: Boolean!) {
  search(text: $text) {
    __typename
    ... on User { id who: name joined role }
    ... on Post { id title tags @include(if: $withTags) author { ...UserFields } }
  }
  node(id: $id) { __typename id kind: __typename }
}
fragment UserFields on User { id name }
```

```ts
export const zSearchQuery = z.object({
	search: z.array(z.discriminatedUnion("__typename", [
		z.object({
			__typename: z.literal("User"),
			id: z.string(),
			who: z.string(),
			joined: scalarSchemas.DateTime,
			role: zRole.nullable(),
		}),
		z.object({
			__typename: z.literal("Post"),
			id: z.string(),
			title: z.string(),
			tags: z.array(z.array(z.string().nullable()).nullable()).nullable().optional(),
			author: z.object({
				id: z.string(),
				name: z.string(),
			}),
		}),
	])),
	node: z.object({
		__typename: z.enum(["User", "Post"]),
		id: z.string(),
		kind: z.enum(["User", "Post"]),
	}).nullable(),
});
export type SearchQuery = z.output<typeof zSearchQuery>;

export const zUserFieldsFragment = z.object({
	id: z.string(),
	name: z.string(),
});
export type UserFieldsFragment = z.output<typeof zUserFieldsFragment>;
```

- **Custom scalars are decoded:** `joined` is a `Date` with
  `@nxgt/graphql-scalars`.
- **`z.object`:** a field the selection does not name is dropped, so a newer
  server's extra field does not fail a parse.
- **A fragment spread is inlined** into the operation: `author` holds
  `UserFields`' `id` and `name`. A fragment has its own schema too, and the
  inlined one is not a reference to it.
- **An abstract type's selection is a `z.discriminatedUnion` on
  `__typename`** when its possible types select different fields, and then
  `__typename` must be selected for every member. Without it generation
  fails, see [Troubleshooting](../troubleshooting.md). A `__typename` under
  `@skip` or `@include` does not count.
- **Possible types that select the same fields share one member**, with
  `__typename: z.enum([...])`: `node` selects only `id` and `kind`, the same
  for `User` and `Post`. A single group is a plain object, not a union.
- **When every possible type selects the same fields, `__typename` is not
  needed:** the result is one plain object. `plain: node(id: $id) { id }`
  gives `plain: z.object({ id: z.string() }).nullable()`. Selected there,
  `__typename` is `z.enum([...])`.
- **An aliased `__typename` is the discriminator under its alias:** the
  union is discriminated on `kind` if the document selects only
  `kind: __typename`. The members must select it under one key; when several
  keys select it, `__typename` is preferred. Otherwise generation fails.
- **A field under `@skip`, `@include` or `@defer` is `.optional()`:** `tags`
  may be absent. A field selected both with and without the directive is
  required, but a sub-field that only the conditional node selects stays
  optional: with `friends { id } friends @include(if: $v) { name }`, `name`
  is optional. A field selected only under the directive is optional, and
  its own fields are not: `maybe: user(id: $id) @include(if: $v) { id }`
  gives `{ id: string } | null | undefined`.
- **A nullable field is `.nullable()`**, not `.nullish()`: a response holds
  null, not undefined.
- `Int` is `z.int32()` and `ID` a `z.string()`, as elsewhere. An enum is its
  schema (`zRole`).
- **An introspection field** (`__schema`, `__type`) is `z.unknown()`.

**Deep selections.** Past five nested levels, a selection is declared apart,
so TypeScript infers an operation of any depth (it failed with TS2589 at
fourteen levels). The helpers are not exported; identical deep selections
share one:

```ts
const zDeepQuery$1$ = z.object({ /* the selection */ });
const zDeepQuery$1: z.ZodType<z.output<typeof zDeepQuery$1$>, z.input<typeof zDeepQuery$1$>> = zDeepQuery$1$;
// zDeepQuery$2 and zDeepQuery$3 the same way, each using the one before.
export const zDeepQuery = z.object({
	user: z.object({
		friends: z.array(z.object({
			friends: z.array(z.object({
				friends: z.array(z.object({
					friends: z.array(zDeepQuery$3).nullable(),
				})).nullable(),
			})).nullable(),
		})).nullable(),
	}).nullable(),
});
```

A fragment's name follows `omitOperationSuffix` and `dedupeOperationSuffix`,
as typescript-operations names it: `fragment UserFields` is
`UserFieldsFragment`, and `UserFields` under `omitOperationSuffix`;
`fragment UFFragment` is `UfFragmentFragment`, and `UfFragment` under either
option.

A fragment on an abstract type, or one that spreads into several places,
follows the same rules. Here `Pinned` selects `pinned`, a union, whose `User`
member holds only `__typename`:

```ts
export const zPinnedFragment = z.object({
	pinned: z.discriminatedUnion("__typename", [
		z.object({
			__typename: z.literal("User"),
		}),
		z.object({
			__typename: z.literal("Post"),
			title: z.string(),
		}),
	]).nullable(),
});
```

On the client, parse the response, then narrow on the discriminator:

```ts
import { zSearchQuery, type SearchQuery } from './generated/zod';

export function names(data: unknown): string[] {
	const { search }: SearchQuery = zSearchQuery.parse(data);
	return search.map((hit) =>
		hit.__typename === 'User' ? hit.who : hit.title,
	);
}
```

## Errors

A schema that declares `@constraint` must be read from its SDL files: an
introspected schema, or one loaded from a URL, has no directives to read and
fails generation. Without `@constraint` it works.

The plugin refuses a schema `withValidation` would refuse, with the same
message: a rule on the wrong type, `@constraint` on an output field, two
declarations of the directive. Those messages are in
[`@nxgt/graphql-validation`'s troubleshooting](https://github.com/softistx/nxgt-graphql/blob/develop/packages/graphql-validation/docs/troubleshooting.md).
The messages of this plugin are in [Troubleshooting](../troubleshooting.md).

## The plugin function

```ts
import { plugin, type CodegenZodConfig, type DocumentFile } from '@nxgt/graphql-codegen-zod';

declare function plugin(
	schema: GraphQLSchema,
	documents: readonly DocumentFile[], // { document?: DocumentNode; location?: string }
	config?: CodegenZodConfig,
	info?: { outputFile?: string },
): Promise<string>;
```

graphql-codegen calls it; call it yourself to generate in a script or a test.
`info.outputFile` lets a relative `scalarSchemas` path be resolved to check
its keys.
