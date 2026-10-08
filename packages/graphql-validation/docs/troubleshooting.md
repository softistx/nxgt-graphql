# Troubleshooting

One entry per error you can hit, headed by the message you will search for.
`withValidation` and `buildSchema` errors happen at startup; the last section
is the one a client sees.

- [Install](#install)
- [Startup](#startup)
- [Silent traps](#silent-traps)
- [Runtime](#runtime)
- [The bin](#the-bin)

## Install

### `TS2307: Cannot find module '@nxgt/graphql-validation'` (or its types)

**When:** type-checking an import of the package.
**Why:** the package is ESM with an `exports` map, which `moduleResolution`
`node`/`node10` ignores, and `nodenext` is not supported.
**Fix:**

```jsonc
{ "compilerOptions": { "moduleResolution": "bundler" } }
```

## Startup

### `@constraint(minLength) on Query.check(age:) needs a String or an ID, not Int.`

**When:** calling `withValidation`.
**Why:** a rule narrows one kind of type. `format`, `minLength`, `maxLength`,
`startsWith`, `endsWith`, `contains`, `notContains` and `pattern` need a
`String` or an `ID`; `min`, `max`, `exclusiveMin`, `exclusiveMax` and
`multipleOf` need an `Int` or a `Float`. The same message, with `an Int or a
Float`, appears for a number rule on a `String`.
**Fix:** use a rule that fits the type.

```graphql
check(age: Int @constraint(min: 18)): Boolean
```

### `@constraint(minItems) on Query.check(name:) needs a list, not String.`

**When:** calling `withValidation`.
**Why:** `minItems` and `maxItems` apply to a list.
**Fix:** put them on a list argument, or use `minLength`/`maxLength` for a string.

```graphql
check(tags: [String!] @constraint(minItems: 1)): Boolean
```

### `@constraint(maxLength) on In.at needs a String or an ID, not DateTime.`

**When:** calling `withValidation`.
**Why:** a rule on a custom scalar, an enum or an input object (`..., not In.`)
has nothing to narrow: only `String`, `ID`, `Int`, `Float` and lists take
rules. The message names the place (`In.at`, `Query.check(input:)`) and the
type. This is checked in every input type, even one no argument reaches.
**Fix:** remove the directive; check a custom scalar in its own definition (for
example with `@nxgt/graphql-scalars`), or on a field with [`validated`](guide/errors.md#validated).

### `Unknown @constraint format "siret". Known formats: byte, date, date-time, email, ipv4, ipv6, uri, uuid.`

**When:** calling `withValidation`.
**Why:** `format` takes one of the listed names. Custom formats are on the
[roadmap](roadmap.md).
**Fix:** use a known format, or `pattern: "..."`.

### `Invalid @constraint pattern "[a-":`

**When:** calling `withValidation`.
**Why:** `pattern` is compiled with `new RegExp`; the text after the colon is
the runtime's own RegExp message, which differs between engines. V8 (Node)
says `Invalid regular expression: /[a-/: Unterminated character class`.
**Fix:** write a valid pattern. In SDL, escape backslashes: `"\\d+"`.

### `Unknown directive "@constraint".`

**When:** in the IDE (JetBrains GraphQL, VS Code GraphQL), on every `@constraint`
in a `.graphql` file. The server runs fine.
**Why:** the plugin reads your schema files and `constraintTypeDefs` is not one.
**Fix:** add the shipped file to `graphql.config.yml`, or write a copy into the
project and list that instead:

```yaml
schema:
  - src/**/*.graphql
  - node_modules/@nxgt/graphql-validation/graphql/constraint.graphqls
```

```sh
bunx nxgt-graphql-validation typedefs --out
```

If the server scans the folder you write it to for its type definitions, the
copy declares the directive for the server too: drop `constraintTypeDefs`, or
keep the copy out of the scan. See the next entry.

### `There can be only one directive named "@constraint".`

**When:** building the schema.
**Why:** `@constraint` is declared twice, usually `constraintTypeDefs` plus a
`constraint.graphqls` copy that the server's type definitions scan picked up.
**Fix:** keep one. Either drop `constraintTypeDefs` and let the scanned copy
declare the directive, or keep `constraintTypeDefs` and exclude the copy from
the scan (it then serves the IDE only).

### `withValidation: this schema declares no @constraint directive. Add constraintTypeDefs to its type definitions.`

**When:** calling `withValidation`.
**Why:** the schema has no `@constraint` directive, so there is nothing to
read. Usually `constraintTypeDefs` was not added, or the schema is code-first and
declares no directive.
**Fix:**

```ts
const typeDefs = [constraintTypeDefs, yourTypeDefs];
```

### `Directive "@constraint" may not be used on FIELD_DEFINITION.`

**When:** building the schema.
**Why:** `@constraint` is allowed on arguments and input fields only.
graphql-constraint-directive also allows output fields; this package refuses
them, since a resolver's result is the job of output scalars.
**Fix:** move it to the argument or input field, or use an output scalar.

### `Unknown argument "uniqueTypeName" on directive "@constraint".`

**When:** building the schema, migrating from graphql-constraint-directive.
**Why:** `uniqueTypeName` is a detail of that package's scalar wrapping and
does not exist here.
**Fix:** remove it.

### `@constraint on Named.name(style:) is not repeated on Person.name(style:), which resolves it (@constraint(maxLength: 5) there, no @constraint here). Write the same @constraint on both.`

**When:** calling `withValidation`, with a `@constraint` on an interface
field's argument.
**Why:** the objects resolve the field, not the interface, so a constraint
the object drops would go unchecked. `Named`, `Person` and `style` are your
interface, object and argument. When the object writes a different constraint
the message reads `... differs on Person.name(style:), which resolves it
(@constraint(maxLength: 5) there, @constraint(maxLength: 5, minLength: 1)
here). Write the same @constraint on both.`
**Fix:**

```graphql
interface Named { name(style: String @constraint(maxLength: 5)): String }
type Person implements Named {
  name(style: String @constraint(maxLength: 5)): String
}
```

### `This schema's @constraint is not constraintTypeDefs': it is allowed on FIELD_DEFINITION; declares uniqueTypeName, which no rule reads. Declare it with constraintTypeDefs.`

**When:** calling `withValidation`, typically after migrating from
graphql-constraint-directive and keeping its SDL.
**Why:** the schema declares its own `@constraint`: extra locations would be
accepted and checked by nothing, extra arguments mean nothing here, and an
argument of another type would reach a rule as the wrong kind of value. The
message lists every difference: `allowed on <LOCATION>`, `declares <name>,
which no rule reads`, or `declares minLength: String, not Int`.
**Fix:** drop the old directive declaration and use the package's.

```ts
const typeDefs = [constraintTypeDefs, yourTypeDefs]; // no other `directive @constraint`
```

### `The default value of Query.a(name:) breaks its @constraint: Too small: expected string to have >=2 characters`

**When:** calling `withValidation`; for an argument (`Query.a(name:)`) or an
input field (`Page.size`).
**Why:** a request that leaves the value out would be refused for something the
client never sent. The text after the colon is the first Zod message.
**Fix:** make the default satisfy the constraint, or relax the constraint.

```graphql
type Query { a(name: String = "xy" @constraint(minLength: 2)): Int }
```

## Silent traps

These raise no error.

### A constrained argument is never refused

**When:** an invalid value reaches the resolver.
**Why:** one of three causes. The schema declares `@constraint` but the constrained
types and fields have no SDL (code-first, or merged pieces): `@constraint` is
read from the SDL, and there is none.
Or `withValidation` was called before a resolver was attached: a resolver set on
a field afterwards replaces the check. Or the schema you serve is not the one
you passed (`withValidation` returns the same schema, so use either).
**Fix:** build from type definitions and call `withValidation` last.

```ts
const schema = makeExecutableSchema({ typeDefs, resolvers });
export default withValidation(schema); // last
```

### `Invalid ISO datetime` for a date-time that looks right

**When:** `format: "date-time"` refuses `2024-03-10t12:00:00z`, `2024-03-10 12:00:00Z` or `2024-03-10T12:00Z`.
**Why:** only the canonical form is accepted: uppercase `T` and `Z`, seconds
present, then `Z` or a numeric offset.
**Fix:** send `2024-03-10T12:00:00Z` or `2024-03-10T12:00:00+02:00`.

## Runtime

### `Invalid arguments for Mutation.signUp. input.email: Invalid email address`

**When:** a request carries an argument that breaks a `@constraint` or a
`validated` schema.
**Why:** the message is `Invalid arguments for <Type>.<field>. <path>: <first
issue>`; `extensions.code` is `BAD_USER_INPUT` and `extensions.issues` lists
every issue. The resolver did not run.
**Fix:** send a valid value, or show each issue beside its field. See
[Errors](guide/errors.md). Common issues:

| Message | Cause |
| --- | --- |
| `Invalid email address` | `format: "email"` |
| `Invalid URL` | `format: "uri"`: not absolute, or a scheme other than `http`, `https`, `ftp` |
| `Invalid ISO datetime` / `Invalid ISO date` | `format: "date-time"` / `"date"` |
| `Too small: expected string to have >=2 characters` | `minLength: 2` |
| `Too big: expected array to have <=2 items` | `maxItems: 2` |
| `Too small: expected number to be >=18` | `min: 18` |
| `Invalid string: must match pattern /.../` | `pattern` |

## The bin

### `typedefs failed: <message>`

**When:** `nxgt-graphql-validation typedefs --out <file>` exits 1, for example
with `typedefs failed: EACCES: permission denied, mkdir 'schema'`, or
`EISDIR` when `<file>` is a folder.
**Why:** the file or its folder could not be written; the rest of the line is
the system's own message.
**Fix:** point `--out` at a file path you can write, or print to stdout and
redirect: `nxgt-graphql-validation typedefs > generated/graphql/constraint.graphqls`.

### `Unknown command "<x>".` or `Unexpected arguments: …`

**When:** the bin exits 2 and prints its usage.
**Why:** the only command is `typedefs`, and its only flag is `--out [<file>]` (and `--help`).
**Fix:** `nxgt-graphql-validation typedefs [--out [<file>]]`; `--help` prints
the usage and exits 0.
