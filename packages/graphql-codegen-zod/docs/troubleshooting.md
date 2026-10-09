# Troubleshooting

One entry per error you can hit, headed by the message you will search for.
Configuration, Scalars, Operations and The schema happen while
`graphql-codegen` runs; The generated file is what `tsc` and the generated
schemas report.

- [Configuration](#configuration)
- [Scalars](#scalars)
- [Operations](#operations)
- [The generated file](#the-generated-file)
- [The schema](#the-schema)

## Configuration

### `@nxgt/graphql-codegen-zod: namingConvention "my-module#myCase" is not one this plugin reads. Use 'keep', a function, or 'change-case-all#<case>' with one of camelCase, capitalCase, constantCase, dotCase, headerCase, noCase, paramCase, pascalCase, pathCase, sentenceCase, snakeCase, lowerCase, upperCase, lowerCaseFirst, upperCaseFirst.`

**When:** running codegen with a `namingConvention` string that names another module, or a case not in the list. The string in the message is what you wrote.
**Why:** the plugin reads the forms the typescript plugins take for type names, but only `change-case-all` and `change-case` cases; it does not load a module.
**Fix:** use one of the forms, or pass a function.

```ts
config: { namingConvention: 'change-case-all#pascalCase' }
// or
config: { namingConvention: (name) => name.toUpperCase() }
```

## Scalars

### `@nxgt/graphql-codegen-zod: the scalar Money is not in zodScalars, and no scalarSchemas is set. Map it: zodScalars: { Money: './module#export' }, or set scalarSchemas: '@nxgt/graphql-scalars'.`

**When:** running codegen on a schema with a custom scalar (here `Money`),
on an input or, since 0.2.0, on an object type's field or in an operation's
result only (`createdAt: Money`). 0.1.0 did not read output fields, so such a
scalar used to need no schema.
**Why:** a scalar written as `z.unknown()` would check nothing, in silence, so
the plugin refuses instead.
**Fix:** map the scalar, or point `scalarSchemas` at a module that has it. If
the scalar is only on output fields and in operations' results, and you do not
need those types, `objects: false` and `operations: false` together skip them:
either alone still reads it, wherever an operation selects the scalar.

```ts
config: { zodScalars: { Money: './money#moneySchema' } }
```

### `@nxgt/graphql-codegen-zod: the scalar Money is neither in zodScalars nor in @nxgt/graphql-scalars's scalarSchemas. Map it: zodScalars: { Money: './module#export' }, or set scalarSchemas: '@nxgt/graphql-scalars'.`

**When:** running codegen with `scalarSchemas` set, on a scalar the record has
no key for. The module path in the message is the one you configured.
**Why:** the plugin loaded the record and `Money` is not one of its keys.
**Fix:** map that one scalar next to the record; `zodScalars` wins over it.

```ts
config: {
	scalarSchemas: '@nxgt/graphql-scalars',
	zodScalars: { Money: './money#moneySchema' },
}
```

### `@nxgt/graphql-codegen-zod: zodScalars.Money is "moneySchema"; write it '<module>#<export>', e.g. './money#moneySchema'.`

**When:** running codegen with a `zodScalars` entry that is not `module#export`.
**Why:** the entry needs a module and an export name on either side of the
last `#`; the one in the message has none, or an empty side.
**Fix:**

```ts
config: { zodScalars: { Money: './money#moneySchema' } }
```

### `@nxgt/graphql-codegen-zod: @nxgt/graphql-scalars exports no scalarSchemas record.`

**When:** running codegen with `scalarSchemas` set.
**Why:** the module loaded, but exports no `scalarSchemas` object. The module
path in the message is the one you configured. For `@nxgt/graphql-scalars`,
the record is exported from 0.4.0; an older version has none.
**Fix:** upgrade the package, or export the record yourself.

```ts
// scalars.ts
import { z } from 'zod';

export const scalarSchemas = {
	DateTime: z.iso.datetime({ offset: true }),
};
```

## Operations

### `@nxgt/graphql-codegen-zod: SignUp's $input has a type the schema does not define.`

**When:** running codegen on a document.
**Why:** the operation (`SignUp`) declares a variable (`$input`) of a type the
schema has no input type for, usually a typo, or a document written against
another schema.
**Fix:** declare the type in the schema, or correct the variable's type in the
document.

```graphql
mutation SignUp($input: SignUpInput!) { signUp(input: $input) }
```

### `@nxgt/graphql-codegen-zod: Bare.search selects the abstract type SearchResult without __typename for User. Select __typename there, so the result tells its members apart.`

**When:** running codegen on a named operation or a fragment. The operation
(or `fragment <Name>`), the path, the type and the member in the message are
yours.
**Why:** when the possible types of an interface or a union select different
fields, the selection becomes a union discriminated on `__typename`, and
without it the result cannot tell the members apart. When they all select the
same fields, no `__typename` is needed. A `__typename` under `@skip` or
`@include` may be absent, so it counts as missing.
**Fix:** select `__typename` in that selection, or set `operations: false`.

```graphql
# fails
query Bare { search(text: "a") { ... on User { id } } }
# generates
query Bare { search(text: "a") { __typename ... on User { id } } }
```

### `@nxgt/graphql-codegen-zod: Keys.search selects __typename under a different key for each member of SearchResult (t, k). Select it under one key for every member, so the result tells its members apart.`

**When:** running codegen on an operation or a fragment. The path, the type
and the keys in the message are yours.
**Why:** the union is discriminated on one key, and the members select
`__typename` under different aliases. When several keys select it,
`__typename` itself is preferred.
**Fix:** select `__typename` under one key for every member.

```graphql
query Keys { search(text: "a") { ... on User { t: __typename id } ... on Post { k: __typename title } } }
```

### `@nxgt/graphql-codegen-zod: Both($v:) is passed to Query.e(v:) (format: "email") and to Query.u(v:) (format: "uuid"), whose schemas cannot both apply. Use one variable for each.`

**When:** running codegen on an operation that passes one variable to two
places whose `@constraint(format:)` differ. The operation, variable and places
in the message are yours.
**Why:** each `format` replaces the schema, so the variable cannot be both.
**Fix:** use one variable for each.

```graphql
query Both($e: String, $u: String) { e(v: $e) u(v: $u) }
```

## The generated file

### `Property 'Money' does not exist on type '{ DateTime: ... }'` (or `TS2339`)

**When:** type-checking the generated file, with `scalarSchemas` set.
**Why:** the plugin loads the record's module to check its keys, but cannot
when it is a `.ts` file under Node. It then trusts the record, and the file
reads `scalarSchemas.Money` which the record lacks.
**Fix:** add the key to the record, or map the scalar with `zodScalars`, or run
codegen under Bun so the module loads and the plugin refuses with the message
above.

```ts
config: { zodScalars: { Money: './money#moneySchema' } }
```

### `TS2300: Duplicate identifier 'SignUpInput'`

**When:** type-checking, with the plugin and `@graphql-codegen/typescript`
writing to the same file.
**Why:** both write a type of the same name.
**Fix:** generate into a file of its own.

```ts
generates: {
	'src/generated/zod.ts': { plugins: ['@nxgt/graphql-codegen-zod'] },
}
```

### A client request is refused for `{ id: 5 }`: `Invalid input: expected string, received number`

**When:** `safeParse` of a variables schema with a number where the schema has
an `ID`.
**Why:** `graphql` accepts an `Int` for an `ID`; the generated schema is
`z.string()`: an id is a string in what the client sends, as in what the
resolver receives.
**Fix:** send the id as a string.

```ts
zUserQueryVariables.safeParse({ id: String(id) });
```

### A client request is refused: `Unrecognized key: "nickname"`

**When:** `safeParse` of a variables schema whose input object carries a field
the input type does not declare.
**Why:** input types are `z.strictObject`, as `graphql` refuses an unknown
field. The variables object itself ignores an extra variable, as `graphql` does.
**Fix:** remove the field, or add it to the input type in the schema.

## The schema

### `@nxgt/graphql-codegen-zod: the file would declare FilterInput twice: two GraphQL names, or a type in a cycle and its Input or Wire type, give the same name. Rename one of the GraphQL types or operations, set typesSuffix, or set objects: false or operations: false.`

**When:** running codegen on a schema where two declarations of the same kind
get one name:
- an input type in a cycle (`Filter`) declares `FilterInput`, or an object
  type in a cycle (`User`) declares `UserWire`, and the schema also has a
  type of that name;
- an object type is named like a type the plugin already writes, such as
  `QueryFindArgs` beside a field `Query.find(...)`. With 0.1.0 this generated,
  because object types were not written.

**Why:** the file cannot declare one name twice.
**Fix:** rename one of the GraphQL types, or set `typesSuffix`: `Filter`
then declares `FilterTInput`, apart from `FilterInputT`. A `typesPrefix`
does not part them. When the clash comes from an object type and you do not
need the output types, `objects: false` writes none of them. When it comes
from an operation's or a fragment's result (`SearchQuery`), `operations:
false` writes none of them.

```graphql
input Filter { and: [Filter] }
input FilterFields { a: Int } # was FilterInput
```

### `@nxgt/graphql-codegen-zod: the default of Query.a(n:) holds 9007199254740993, which a JavaScript number cannot keep exact. Write it as a string, if its scalar takes one.`

**When:** running codegen on an argument, input field or variable whose
default is an integer past `Number.MAX_SAFE_INTEGER`, given to an `ID` or a
custom scalar (`Long`, `BigInt`). An `Int` or a `Float` rounds on the server
too, and is written as it is.
**Why:** the generated `.prefault(...)` would hold a rounded number, while the
server hands the scalar every digit.
**Fix:** write the default as a string, when the scalar parses one.

```graphql
type Query { a(n: Long = "9007199254740993"): Int }
```

### `@nxgt/graphql-codegen-zod: the schema declares @constraint, but Query has no SDL to read it from (an introspected schema?). Point codegen's schema at the SDL files.`

**When:** running codegen on a schema that declares `@constraint` but was
introspected or loaded from a URL. The type in the message is the first found.
**Why:** an introspected schema carries no directives on its arguments, so
every constraint would be dropped in silence.
**Fix:** point codegen's `schema` at the SDL files. A schema without
`@constraint` can still be introspected; its defaults are read back.

```ts
schema: 'src/schema/**/*.graphql',
```

### Errors of `@constraint`

The plugin refuses a schema `withValidation` would refuse, with the same
message, for example `@constraint(minLength) on Query.a(n:) needs a String or
an ID, not Int.`. Each is explained, with its fix, in
[`@nxgt/graphql-validation`'s troubleshooting](https://github.com/softistx/nxgt-graphql/blob/develop/packages/graphql-validation/docs/troubleshooting.md).

### No error, and nothing is constrained

**When:** the generated schemas have no `.min()`, `.email()` and the like.
**Why:** the schema codegen reads does not declare `@constraint`, so the
plugin reads none; plain types are still generated, without a warning.
**Fix:** add the directive to the schema codegen loads.

```ts
import { constraintTypeDefs } from '@nxgt/graphql-validation';
```
