# AGENTS.md

Instructions for any coding agent working in `nxgt-graphql`.

Worktrees, integration branches, merges and releases, and questions to the
owner follow the owner's global rules in `~/.claude/CLAUDE.md`; this file
states only what is this repository's own.

## What this repository is

GraphQL building blocks for applications built on the nxgt packages,
published to the public npm registry. The repository and every package in it
are public.

| package | what it is |
| --- | --- |
| `@nxgt/graphql-scalars` | GraphQL scalars whose every crossing is checked by one Zod schema: `zodScalar(schema, { name })` and the scalars built on it, by category (one page each under `docs/guide/scalars/`), with `scalarTypeDefs` and `scalarResolvers` for a schema-first server, `pickScalars(...names)` for some of them, `graphql/scalars.graphqls` and the `nxgt-graphql-scalars typedefs` bin for IDEs and servers that scan `.graphql(s)` files, each schema (`dateTimeSchema`, `schemas.dateTime`, or `scalarSchemas.DateTime` by GraphQL name, read by `@nxgt/graphql-codegen-zod`) for use outside GraphQL, and graphql-codegen's `scalars` config (`codegenScalars` for a server, `clientCodegenScalars` for a client). Depends on `@nxgt/zod`, which holds every schema; peers: `graphql`, `zod`, `typescript` |
| `@nxgt/graphql-validation` | `@constraint` on arguments and input fields (graphql-constraint-directive's arguments minus `uniqueTypeName`), each checked by a Zod schema built from the directives: `constraintTypeDefs`, `withValidation(schema, { formats? })` (the application's own formats, a record of Zod string schemas), `validated(schema, resolver)` for what a directive cannot say, `badUserInput(where, zodError)`. One `BAD_USER_INPUT` error whose `extensions.issues` carry the path and the refusing rule. Ships `graphql/constraint.graphqls` and the bin `nxgt-graphql-validation typedefs [--out [<file>]]` for IDEs. Peers: `graphql`, `zod`, `typescript` |
| `@nxgt/graphql-codegen-zod` | A graphql-codegen plugin writing Zod schemas and their types from the SDL: enums, input types, each field's arguments (`z.output`, what the resolver receives), each named operation's variables (`z.input`, what a client sends), each object type, interface and union (`z.output`, what a resolver returns), and each named operation's result and fragment (`z.output`, what the response holds), with every `@constraint` through `@nxgt/graphql-validation/codegen`. Schemas `zSignUpInput`, types named as the typescript plugins name them. Custom scalars from a `scalarSchemas` record or `zodScalars`; the application's own formats from a `formatSchemas` record or `zodFormats`, imported and chained on (`formatSchemas.slug.max(40)`). Depends on `@nxgt/graphql-validation`; peers `graphql`, `zod`, `typescript` |

A package here is named `@nxgt/graphql-<what>`: the `@nxgt` scope is shared
by every nxgt repository, and `scalars` alone would not say what it is for.

It is **Bun-first**: ESM, tested with `bun test`, no Bun-only API in the
library.

## Layout

The package is laid out for a hundred scalars, not seven: adding one touches
one category and nothing else.

```
packages/graphql-scalars/src/
  zod-scalar.ts            the factory
  codegen-scalars.ts       graphql-codegen's `scalars` config, read from the schemas
  type-defs.ts             the SDL of a set of scalars
  pick-scalars.ts          pickScalars(...names)
  cli.ts                   the `nxgt-graphql-scalars` bin (shebang kept by the build)
  typedefs-command.ts      its `typedefs [<Name>...] [--out [<file>]]` command
                           (0 done, 1 write failed, 2 usage); .spec.ts beside it
  scalars/
    all.ts                 one `export *` line per category
    index.ts               derives scalarResolvers, scalarSchemas, schemas, scalarTypeDefs from all.ts
    registry.spec.ts       the guards below
    <category>/            date-time, identifier, network, number, string, ...
      index.ts             one `export *` line per scalar
      <name>.ts            one scalar: `<name>Schema` re-exported from
                           `@nxgt/zod/scalars`, then `<Name>Scalar` (its
                           name, description, specifiedByURL, literals)
      <name>.spec.ts       its cases, through test/scalar-cases.ts
                           (scalarCases; integerCases for an integer one)
```

The rules themselves are not here: each schema, and the building blocks
several share (`src/rules/` there: offset, hostname, big-integer, integer,
json, ...), live in `@nxgt/zod` (softistx/nxgt-zod, `packages/zod`).

- **`packages/graphql-scalars/graphql/scalars.graphqls` is generated**: the
  SDL of every scalar, shipped by path (`graphql` is in `files`, not in
  `exports`), exactly what `nxgt-graphql-scalars typedefs` prints with no
  names. Never edit it: `bun run --cwd packages/graphql-scalars
  typedefs:write` regenerates it, and `typedefs-command.spec.ts` fails, naming
  that command, when a scalar was added and the file was not.
- **A new scalar is a file, its spec, and one line** in its category's
  `index.ts`, once its schema is published in `@nxgt/zod`. A new category is a
  folder and one line in `all.ts`. Nothing is listed by hand anywhere else:
  `scalarResolvers`, `scalarSchemas`, `schemas`, `scalarTypeDefs`,
  `codegenScalars` and `clientCodegenScalars` are derived
  from what `all.ts` exports, in the code-unit order of a module namespace
  (`IBAN` before `IP`, `HSLA` before `HSL`; `schemas` by the `…Schema` names,
  `hsl` before `hsla`).
- **`registry.spec.ts` fails when one is forgotten**: a file that is not
  registered, has no spec beside it, exports anything but one scalar and one
  schema (a helper would reach the package root), is not named after its
  scalar, or has no `## \`<Name>\`` section in its category's page,
  `docs/guide/scalars/<category>.md` (a category with no page, or a page
  with no category, fails too). The name
  rule: the file is the GraphQL name's letters, lowercase, hyphens at word
  breaks (`DateTime` in `date-time.ts`, `IPv4` in `ipv4.ts`); the exports are
  `<Name>Scalar` and the same letters camelCased plus `Schema`
  (`dateTimeSchema`, `ipv4Schema`). Two categories exporting the same name
  fail `tsc` (TS2308, an ambiguous `export *`); two files with the same
  GraphQL name fail the count. A type-only export is invisible at runtime, so
  the guard does not see it. A file whose options say `literals: 'integer'`
  fails unless its spec calls `integerCases`; `src/index.spec.ts` fails when
  the package root exports anything but a `*Scalar`, a `*Schema`,
  `zodScalar`, `pickScalars`, `scalarResolvers`, `scalarSchemas`, `schemas`,
  `scalarTypeDefs`, `codegenScalars` or `clientCodegenScalars`. Those two are
  derived from `scalarSchemas` (`src/codegen-scalars.ts` reads each schema's
  Zod definition), never written per scalar: on a server `z.output` in and
  `z.output | z.input` out (serialize takes both), on a client `z.input` out
  and in, plus `Date` where the scalar takes a `Date`'s JSON form.
  `codegen-scalars.spec.ts` asks tsc for `z.input`/`z.output` of every
  `ScalarName` and holds each entry to that text, so a scalar whose type the
  reader cannot name fails there.
- **The schema export ends in `Schema`.** `export *` lifts it to the package
  root, where a bare `url` or `date` would read as something else.

## Layering

`@nxgt/graphql-scalars` depends at runtime on `@nxgt/zod` only, by an npm
range (`^0.1.3`: another repository, so never `workspace:`), for its schemas;
`@nxgt/zod` peers the same `zod` range, so an application holds one `zod`.
`@nxgt/graphql-validation` depends on nothing at runtime. Neither depends on
the other. `@nxgt/graphql-codegen-zod` depends on
`@nxgt/graphql-validation` (its `./codegen` subpath) and `change-case` (the
typescript plugins' PascalCase), never on scalars: it imports a scalar record
by the module name its config gives; `graphql` and `zod` are peers, each pinned
exactly as a devDependency at the oldest end of its range
(`graphql` `16.11.0`, `zod` `4.6.5`). `zod`'s range, `>=4.6.5 <5`, is
nxgt-data's (`@nxgt/mongo`, `@nxgt/redis`): one range is one zod in an
application's tree. Siblings, when there are some, depend on each other by
`workspace:^`.

## Invariants

Each of these is a promise in the public API, and a spec proves it. A change
that weakens one is a breaking change, even when every spec stays green.

- **`scalarSchemas` is a contract with code generators.** Its name, its keys
  (the GraphQL names, as `scalarResolvers`'), and each entry being the very
  schema the scalar checks, typed exactly, are read by
  `@nxgt/graphql-codegen-zod`'s generated code (`typeof scalarSchemas.X`).
  It is derived from each scalar's `.schema`, so a new scalar joins it with
  no step of its own; `scalar-schemas.spec.ts` pins all three, and that it is
  `@nxgt/zod`'s `scalarSchemas` entry for entry (`===`, same keys, same
  order), so a schema there with no scalar here, or the reverse, fails.

- **graphql 16 and 17 both work.** `zodScalar` passes the legacy
  `serialize`/`parseValue`/`parseLiteral` (all graphql 16 calls) and the
  `coerceOutputValue`/`coerceInputValue`/`coerceInputLiteral` graphql 17
  calls in their place. The config is built in a variable, not passed as a
  literal, so graphql 16's config type does not refuse the names it lacks.
  The main CI job proves 16 (the lockfile), the "Newest peers" job 17.
- **One schema checks both ways.** An input is decoded (`z.safeDecode`), a
  resolver's result is encoded (`z.safeEncode`). A result the encoding refuses
  is decoded first, as a client's value would be, then encoded: a resolver may
  return the wire form (an ISO string for `DateTime`, a safe number for
  `Long`), and what goes out is canonical either way. A value neither way takes
  is refused with the encoding's issue, never written to the wire as it is. A schema that changes a value
  must be a `z.codec`; a `.transform()` has no way back.
- **A refusal never names the value.** `<Name> cannot represent this input:
  <issue>` and `<Name> cannot serialize this value: <issue>`, with Zod's first
  issue only; no issue of a built-in schema contains the value (Zod's `received
  NaN` or `received Infinity` names a kind of number, not the input). A refused
  literal carries its node, so the client gets its location. What Zod throws
  rather than fails on (a `.transform()` on the way out, an async check, a
  codec's own error) is a `GraphQLError` too, the original as its
  `originalError`. A user schema's own issue can hold input (a custom message,
  `Unrecognized key`), and graphql 16 — not 17 — adds a bad variable's value to
  its own message: neither is ours to remove. Our own messages read `Invalid
  <format>[: hint]` (`Invalid URL: write the scheme lowercase`), the hint saying
  what to send, never what was sent.
- **An input is taken in its canonical form only.** A scalar refuses a
  variant spelling rather than rewriting it (`007`, `-0`, `-00:00`, a URL
  with a tab), so the value a resolver receives is the one the client sent.
  Zod's own rewrites are refused before they happen (`URL` refuses the
  white space `z.url()` would trim or drop). Hex digits, and the letters of
  these formats, are taken in any case, mixed included, and kept as sent:
  `UUID`, `UUIDv4`, `UUIDv7`, `GUID`, `ULID`, `ObjectID`, `SHA256`,
  `SHA512`, `Hexadecimal`, `HexColorCode` (its short forms too), `IPv6`,
  `CIDRv6` and `MAC` (Zod's `z.mac()` takes one case per address; ours any,
  `:` its only separator as Zod's). `IPv6`'s compressed and full forms are
  both taken, unchanged. Where the format's own reference reads one case
  only (rs/xid's `XID`), the scalar takes that case only.
- **`DateTime` is an instant, `Date` is not.** `DateTime` requires an offset,
  not `-00:00` (`@nxgt/zod`'s `src/rules/offset.ts`, shared with `Time` and
  `UtcOffset`), resolves to a `Date` and serializes a `Date` (or a valid RFC 3339 string),
  in UTC. The
  fraction is cut to three digits before `new Date` reads it, so no engine's own
  parser is involved, and an instant outside 0000-01-01 to 9999-12-31 UTC (what
  `toISOString()` writes as RFC 3339) is refused both ways. `Date` stays a
  `YYYY-MM-DD` string on both sides: a `Date` would shift it by a day in half
  the time zones.
- **`URL` is `http:` or `https:` only.** Zod's `z.url()` alone accepts
  `javascript:` (measured on zod 4.6.5), and a client is likely to put the value
  in an `href`. The pattern must stay exactly `/^https?$/`: Zod reads that
  source to also refuse `https:example.com`; the refines below refuse it too, so
  a spec reads the check's `protocol` source and pins it. On top of Zod: the
  scheme lowercase, then `//` and a host as written that is a `Hostname`
  (`@nxgt/zod`'s `src/rules/hostname.ts`), a canonical IPv4 or a bracketed IPv6
  — never what only a URL parser reads as one (`https://123`, `https://0x7f.1`,
  `a_b.com`) — and an optional port with no leading zero; no user info
  (credentials in an `href` leak); no white space, control or invisible format
  character (`\p{Cf}`) anywhere. What a parser rewrites to an equivalent is kept
  as sent: an uppercase host, a default port (`:443`), dot segments,
  percent-escapes in the path. That check runs before `z.url()`, as a check of
  the same `z.string()` rather than a pipe, so it sees the value Zod would trim.
- **`PositiveInt`, `NegativeInt`, `NonNegativeInt` and `NonPositiveInt`
  are 32 bits**, as GraphQL's `Int` is. `SafeInt` (±(2⁵³ − 1)), `Long`
  (64 bits) and `BigInt` (unbounded) are not, and say so in their name.
- **`Long` and `BigInt` are a string on the wire, always.** A `bigint` in the
  resolvers; as input a canonical decimal string or a safe-integer number. A
  number past 2⁵³ is refused, never rounded, from a client or a resolver
  (`@nxgt/zod`'s `src/rules/big-integer.ts`).
- **An integer scalar reads literals as GraphQL's `Int` does**: a float
  literal (`1.0`, `1e3`) is refused, through `zodScalar`'s
  `literals: 'integer'`, and so is `-0`: by the bound for `PositiveInt` and
  `NegativeInt`, by `@nxgt/zod`'s `src/rules/big-integer.ts` for `Long` and
  `BigInt`, by its `src/rules/integer.ts` for the rest. `integerCases()` in
  `test/scalar-cases.ts` proves both for each one.
- **`TimeZone` is what the runtime's `Intl` knows, aliases included.** Node and
  Bun disagree on which name of a zone is canonical (Node turns `Asia/Kolkata`
  into `Asia/Calcutta`), so an alias is not refused, and the value is kept as
  sent. The case must be the zone's own; for an alias Node rewrites, that is a
  heuristic over each word's shape (`@nxgt/zod`'s `time-zone.ts`): it refuses no
  tzdata name, measured on Bun and Node, and on Node lets through a miscasing
  whose words still look like IANA words (`ASIA/Kolkata`, `ZULU`, `Prc`). Bun
  lets none through. An offset is `UtcOffset`'s, never a `TimeZone`.
- **`JSON` and `JSONObject` read every literal** (`literals: 'any'`), and refuse
  both ways what JSON cannot write back as it is: a cycle, `undefined`, a hole,
  a `Date`, `NaN`, `-0` (JSON writes it `0`), nesting past 1000 levels
  (`@nxgt/zod`'s `src/rules/json.ts`). A variable inside a literal is read as
  graphql 17's `replaceVariables` reads it, on 16 too (`untypedValue` in
  `zod-scalar.ts`, not graphql 16's `valueFromASTUntyped`): left out, it drops
  an object field and makes a list item `null`; validation sees every variable
  left out, on both. Two graphql 16 limits a scalar cannot fix: a variable of a
  custom scalar inside the literal arrives as its resolver value (a `Date`, so
  `JSON` refuses it; 17 passes its wire value), and an object or list *default*
  for a `JSON` argument makes introspection and `printSchema` throw (`Cannot
  convert value to AST`).
- **`Void` is `null` only.** GraphQL writes `null` without calling the
  scalar, so a resolver that returns nothing answers `null`; one that
  returns a value is refused, not silently dropped.
- **`Locale`'s canonical form is checked here, not taken from `Intl`.** V8
  rewrites every CLDR alias (`tl` → `fil`, `en-UK` → `en-GB`, and inside `-t-`:
  `en-t-iw` → `en-t-he`), JavaScriptCore only some, so comparing a tag, or its
  extensions, with `Intl.getCanonicalLocales` answered differently on Node and
  Bun. `Intl` only says whether the tag is well-formed, which both engines agree
  on; `@nxgt/zod`'s `locale.ts` checks the rest: the case before the first
  extension, then extensions all lowercase, singletons ascending (`-x-` ends the
  tag: what follows is private use), `-u-` attributes sorted before keywords
  sorted by key, each key once and never `-true`, `-t-` fields sorted by key. An
  alias is kept as sent, a value's alias too (`en-u-ca-islamicc`,
  `en-u-kb-yes`). Measured identical on Node and Bun over 118 tags.

## @nxgt/graphql-validation

The sections above are `@nxgt/graphql-scalars`'; this one is the validation
package's, laid out the same way for growth: a new rule or format is a file.

### Layout

```
packages/graphql-validation/src/
  constraint-directive.ts  constraintTypeDefs (written from the rules), assertOwnConstraint
  with-validation.ts       wraps each constrained field's resolve (or subscribe) in place
  validated.ts             a resolver checked by a hand-written schema
  bad-user-input.ts        the one error, and parseArgs
  typedefs-command.ts      the bin's `typedefs` command; cli.ts is the bin itself
  codegen.ts               the `./codegen` subpath, for @nxgt/graphql-codegen-zod
  registry.spec.ts         the guards below
  rules/                   one @constraint argument per file: `<argument>Rule`
    rule.ts                Rule, defineRule, literal
    all.ts                 one `export *` line per rule
    index.ts               `rules` keyed by argument, applyRule, constraintOf
  formats/                 one format per file, `<name>Format`; format.ts, all.ts, index.ts alike;
                           registry.ts, FormatRegistry: the built-in formats plus the
                           application's, one Map, handed to every rule as RuleContext;
                           marked.ts, how an application's format runs (zod's public API)
  builder/                 GraphQL types to Zod: InputSchemas, argsSchemaOf, leaf, constraints;
                           check-constraints.ts, every startup check;
                           input-code.ts, the same walk written as source
packages/graphql-validation/graphql/constraint.graphqls   shipped, generated: `bun run typedefs:write`
```

- **A new rule or format is a file, its spec, and one line in its `all.ts`.**
  The directive's SDL, the registry, `constraintOf` and the list of known
  formats follow. `registry.spec.ts` fails a file that is unregistered, has no
  spec, exports anything else (a helper would reach the registry), or is not
  named after its argument (`minLength` in `min-length.ts`, `minLengthRule`);
  `rule.ts`, `format.ts`, `formats/registry.ts` and `formats/marked.ts` are
  its helpers, the only files it skips.
  Then regenerate `graphql/constraint.graphqls`: a spec fails until you do.
- **No module-global format lookup.** A rule's `toZod`/`toCode` take a third
  argument, `RuleContext` (`{ formats: FormatRegistry }`), threaded from
  `InputSchemas`, `leafSchema`, `checkConstraints` and `inputCode`;
  `registryOf(record)` builds and checks a registry once per record (a
  `WeakMap`), `registryOf()` is the built-in one.
- **Every rule and built-in format is written twice:** `toZod`, applied at startup, and
  `toCode`, the same schema as source for a code generator, `z` a free
  identifier. Each spec goes through `test/rule-cases.ts`, which evaluates the
  source and requires both to accept and refuse the same inputs, and every
  refusal to be owned (`owns`) by that rule and no other.
- Rules, formats and the builder are internal. `./codegen` exports only what
  the codegen plugin needs (`checkConstraints`, `constraintsOn`, `inputCode`,
  the types `Constraint` and `InputCodeOptions`). Of a `Constraint`'s `rule`,
  `argument`, `target` and `base` are public (the plugin merges a variable's
  constraints with them); the rest of the rule is not;
  widening it is a public-API decision. `withValidation` runs its startup
  checks through `checkConstraints`, so the generator refuses the same
  schemas.
- **`inputCode` mirrors `InputSchemas`:** both refuse a constraint that cannot
  apply through `assertLeafTargets`/`assertObjectTargets` (one message), and
  `input-code.spec.ts` requires the generated source to accept and refuse what
  the runtime does. A change to one walk changes the other.
- `graphql/constraint.graphqls` is in `files` but not in `exports`:
  `verify:artifacts` imports every `exports` key, and a `.graphqls` is no
  module. Consumers reference it by path.

### Invariants

- **graphql 16 and 17 both work**, proved as for scalars.
- **`@constraint` is never a silent promise.** It is declared on
  `ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION` only. `withValidation` throws,
  naming the place, on a constraint that cannot apply (wrong kind, custom
  scalar, enum, input object, list rule off a list, unknown format, bad
  pattern), in every input type whether an argument reaches it or not; on a
  `@constraint` declared otherwise than `constraintTypeDefs` (repeatable
  included); on a `@constraint` on a directive's argument; on a default value
  that breaks its own constraint, coerced as graphql coerces it; and on an
  object field that drops or changes the `@constraint` its interface writes on
  an argument.
- **The resolver receives the parsed arguments, and nothing else changes.** An
  absent argument or input field stays absent, a `@oneOf` input keeps its one
  key, a field with nothing to check is not wrapped, wrapping twice wraps
  nothing, and a subscription is checked once, in `subscribe` (graphql's default
  one when the field has none).
- **One error shape.** `Invalid arguments for <Type>.<field>. <path>: <first
  message>`, `extensions.code` `BAD_USER_INPUT`, `extensions.issues` each with
  its path relative to the arguments, Zod's `code`, and `constraint` (the
  refusing `@constraint` argument) when a directive refused. `validated` and
  `badUserInput` raise the same, without `constraint`.
- **An application's format is a Zod string schema, and changes nothing.**
  `withValidation(schema, { formats })` and the two `./codegen` exports take
  the same record. Its keys match `/^[a-z][a-z0-9-]*$/` and never name a
  built-in format (typed `never` by `OwnFormats`, refused at startup too); each
  value's definition is `type: 'string'` (`z.string()` or a string format,
  never a pipe, so no transform or codec), read from `_zod.def` so another zod
  copy passes, and nothing in it rewrites the value though it keeps
  `type: 'string'` (`rewrites`, from an audit of zod 4.6.5's string schemas):
  no `coerce` (`z.coerce.string()`), no `format: 'url'` on the schema or a
  check (`z.url()`, `z.httpUrl()`, `.url()` trim, drop tabs and newlines, or
  normalise), no `check: 'overwrite'` (`.trim()`, `.toLowerCase()`,
  `.toUpperCase()`, `.normalize()`, `.slugify()`, `.overwrite()`). A client
  chaining rules on such a schema would check the rewritten value in place of
  what was sent. What no definition shows (a `.check()` setting `ctx.value`)
  `marked` catches as it runs: a parse whose output differs from its input
  throws a plain `Error` naming the format, a programming error like a
  resolver's bug, never a `BAD_USER_INPUT`. A zod upgrade re-runs the audit. An unknown format lists the
  application's after the built-in ones. Its entry has no `toCode`: the generator writes it, through
  `InputCodeOptions.format(name)` (threaded to the rule as
  `RuleContext.formatCode`), the other rules chained on that source; without
  the option `inputCode` throws. Wrapping a schema again with other formats, or
  none after some, throws (the record is kept on the schema under a
  `Symbol.for` key); with the same names and the very same schemas it is the
  usual no-op. A string definition without `safeParseAsync`, `check`,
  `refine` and `catch` (an object shaped like a schema, a `zod/mini` one) is refused
  at startup too, since every request calls them.
- **An application format runs through zod's public API only** (owner: a zod
  4 release must not break it, and a user's format must never crash the
  server). `formats/marked.ts` calls the schema's `safeParseAsync`, derives
  probes with `check` (pushing to `ctx.issues`), `refine` (with `when`) and
  `catch`, and reads the issues they return: never `_zod.run`,
  `z.core.util.finalizeIssue`, `z.core.config`, a raw issue's `continue`,
  nor a synchronous `safeParse` (which starts an async check and drops its
  promise). Startup reads `_zod.def` (zod's introspection) only to refuse a
  schema; what `rewrites` misses is caught at run time. `marked.spec.ts`
  runs the matrix (sync, async, abort, raw push, rewriting, default value,
  a throwing check) on schemas reached through their public API only,
  `_zod.run` gone or throwing, and on schemas whose `_zod.run` returns
  issues without `continue` (`test/public-only.ts`); `another-zod.spec.ts`
  does it on another copy. Never reach into zod internals again.
- **An application format's issue is `format`'s, whatever its code, and the
  rules after it run inside it.** `leafSchema` hands the rules written after
  an application's format to `Format.narrowed`: the leaf is one
  `z.string().check` that runs the format, then replays its issues, marked
  `params.nxgtConstraint: 'format'` (`RULE_PARAM`), through a `z.string()`
  narrowed by those rules, so zod itself decides which rules run after them,
  exactly as on the client where they are chained on the schema.
  `constraintOf` reads the mark before any `owns`: a `.regex()` or
  `.refine()` inside the format is not `pattern`'s or `notContains`'. The
  abort is read from two refinements chained after the format's checks: a
  plain one, skipped after any issue that does not continue (`abort: true`,
  a raw push), and one with a `when`, skipped only after `continue: false`;
  each marks a refused run's issues (`nxgtSentinel`), and the issues are
  replayed with that `continue` (true, absent, false). Once the format has
  gone async, the client has run the rules before its issues arrive: the
  replay runs them too, the format's issues first. `toZod()` (no rules) is
  for a caller that chains rules itself, which then run eagerly.
- **An async check runs once per value, from the first, and never leaves a
  promise unhandled.** `marked` runs the format with `safeParseAsync` only;
  a `.catch()` then a `.refine()` chained last tell, when the call returns,
  whether the run finished synchronously (zod runs a schema's checks within
  the call until one returns a promise): then the result is used at once,
  so a default value's synchronous check still works. Otherwise the promise
  goes to the enclosing parse, with a handler; a synchronous parse throws
  zod's async error, and `checkDefaults` throws naming the field and the
  format (`FormatRegistry.takeAsync`). A check that throws ends the run's
  promise too: in a request the operation fails with its error, at startup
  it reads as async (documented). Should a zod release run no check within
  `safeParseAsync`'s call, every format would read as async at startup (a
  loud refusal of its default values, never a crash): the newest-peers run
  catches it. Cost measured on Bun 1.4.2 against 0.3.0: about 0.1 µs per
  accepted value, 1.5 µs per refused one.
- **`uri` is http, https or ftp, scheme required; `date-time` is canonical RFC
  3339 with `Z` or an offset.** Both stricter than graphql-constraint-directive,
  on purpose, each pinned by a spec.
- **`uri` is the one documented exception to "the resolver receives what was
  sent"** (owner): `z.url()` trims surrounding white space, so for
  `" https://a.com "` the resolver receives `"https://a.com"` and a `maxLength`
  after it counts the trimmed value. The generated client runs the same
  schema, so server and client agree. An application's format may not do this
  (`rewrites` refuses it).
- **The bin exits 0 done, 1 the file could not be written, 2 a usage error**,
  nxgt-mongo-backup's convention, and runs under Node and Bun. Its flags read
  as `nxgt-graphql-scalars typedefs`' do (owner): `--out` alone writes
  `generated/graphql/constraint.graphqls`, `--help`/`-h` anywhere wins, and
  `typedefs:write` is the package script that regenerates the shipped file.

## @nxgt/graphql-codegen-zod

The Zod codegen plugin: it writes, as source, the schemas `withValidation`
builds at runtime, so it shares their rules instead of copying them.

### Layout

```
packages/graphql-codegen-zod/src/
  index.ts                 plugin(schema, documents, config, info): checkConstraints, then the blocks
  config.ts                CodegenZodConfig
  naming.ts                the typescript plugins' names, behind schemaPrefix for schemas
  scalars.ts               ScalarSources: `zodScalars` entries (never `scalars`, the typescript plugins' option a root config shares), then the scalarSchemas record
  formats.ts               FormatSources: `zodFormats` entries, then the formatSchemas record, loaded (never trusted) and handed to checkConstraints and inputCode
  modules.ts               importModule (relative to the generated file, or a package) and `<module>#<export>` parsing, shared by both
  imports.ts               the generated file's imports, zod first, aliases on a clash
  writer.ts                one value's schema: inputCode, .prefault, the single-or-list union
  defaults.ts              defaultLiteral, parsedDefault (exact integers), coerced
  source.ts                declare, docComment, objectMembers (getters)
  schema-output.ts         enums, input types (@oneOf as a union), field arguments
  objects-output.ts        object types, then interfaces and unions as z.union (option `objects`)
  results-output.ts        each fragment's and named operation's result (option `operations`), deep selections declared apart
  results-selections.ts    a selection as z.object, a union of members on __typename, the optional and nullable rules
  collect-fields.ts        graphql's CollectFields: inline fragments and spreads, @skip/@include/@defer, merged keys
  output-types.ts          an object type in a cycle, its types written out
  cycles.ts                inputCycles, outputCycles: the types that reach themselves
  type-code.ts             declareCyclic: a cyclic input type's Filter / FilterInput types
  variables-output.ts      each named operation's variables, constraints from their usages
  plugin.spec.ts           the guards below
packages/graphql-codegen-zod/test/
  fixture.ts               the SDL and operations the specs generate from
  formats.ts, sku.ts       the application's formats: a formatSchemas record (one hyphenated key) and one zodFormats export (plus the rewriting ones generation refuses: .trim(), z.url(), z.coerce.string())
  generated.ts             generated, typechecked: `bun run generated:write`
  real-scalars.ts          every @nxgt/graphql-scalars scalar, alone and in a list
  generated-scalars.ts     generated against the real scalarSchemas record, typechecked
  types.ts                 what the generated types say, checked by typecheck
```

### Invariants

- **The client refuses what the server refuses.** `plugin.spec.ts` serves
  the fixture behind `withValidation` and runs each case both ways, operation
  by operation. A change to how a value is written is proved there, not
  argued.
- **The plugin refuses what `withValidation` refuses**, with its message:
  it runs `checkConstraints` before writing anything, with the application's
  formats loaded from `formatSchemas`/`zodFormats`. It also fails, rather
  than write a weaker schema, on a custom scalar with no mapping (never
  `z.unknown()`), a variable passed to two different `format`s, and a schema
  that declares `@constraint` without SDL (introspected: no directive to read).
- **An application's format is loaded, never trusted** (owner): unlike a
  `scalarSchemas` record (whose unloadable module is trusted), a format
  module that cannot be imported fails generation, naming the option and
  what to do, since `checkConstraints` needs the real schemas to check
  defaults. The generated file imports the user's schema and chains the
  other rules on it (`formatSchemas.slug.max(12)`, `formatSchemas["country-code"]`
  for a key that is no identifier); built-in formats stay inline. The client's
  issues carry no `constraint`, as for a built-in format. `plugin.spec.ts`
  serves the fixture behind `withValidation(schema, { formats })` with the
  same record, and `formats.spec.ts` pins messages and the config errors.
- **Input types are `z.strictObject`**, as graphql refuses an unknown field;
  variables and args objects stay `z.object`. Defaults are coerced as graphql
  coerces them, through lists and nested input literals.
- **Every list takes a single value, as graphql does** (owner: uniform),
  through `inputCode`'s `list` option, which hands the list's named type: the
  value is wrapped, then piped into the list's schema, so the client's issue
  is the server's (path, message). An input object's or a custom scalar's
  first stage is `z.custom<z.input<typeof X>>`, so it is parsed once. An Int
  for an ID stays refused (owner: « on garde seulement id comme string »).
  The parity spec pins it, with a codec `DateTime` on both sides and a cycle
  through a `@oneOf`.
- **Output types are what a resolver returns** (owner): `z.object`, so an
  unknown field is dropped; `__typename` optional; custom scalars decoded;
  interfaces and unions a plain `z.union`, declared after every object type; an
  object type in a cycle has its types written out (`outputCycles`,
  `output-types.ts`), as an input type in a cycle does (TS2589 past a loop of
  ten); objects reaching each other through getters. `objects: false` writes
  none.
- **Operation results are what the response holds** (owner): `z.output`, so
  custom scalars are decoded (`joined` is a `Date`); `z.object`, so an unknown
  field is dropped; a fragment spread is inlined; a selection on an abstract
  type is a `z.discriminatedUnion` on `__typename` only when its possible
  types select different fields (owner), and then `__typename` must be
  selected under one key for every member (aliased, it is the discriminator
  under its alias; `__typename` preferred), else generation fails; when they
  all select the same fields it is one plain object, no `__typename` needed;
  past 5 nested levels a selection is declared apart (`zX$1$` and a
  `z.ZodType<output, input>` const, shared when identical) so TypeScript
  infers any depth (owner; TS2589 at 14); fragment names follow
  `omitOperationSuffix`/`dedupeOperationSuffix`;
  possible types selecting the same fields share one member,
  `__typename: z.enum([...])`, and one group is a plain object; a field under
  `@skip`/`@include`/`@defer` is `.optional()`, and so is a sub-field only a
  conditional node selects, unless that node is the field's only one (its
  presence implies the condition); a nullable field is `.nullable()`, a
  response holding null, not undefined; an introspection field is
  `z.unknown()`. Fragments come before operations. `operations: false` writes
  none and keeps the variables.
- **An input type in a cycle has its types written out** (`Filter`,
  `FilterInput`, `zFilter: z.ZodType<Filter, FilterInput>`), owner's call: a
  transform around a type inside its own getter defeats TypeScript's inference.
  Types outside a cycle stay derived (`z.output<typeof zX>`). `type-code.ts`
  mirrors `Writer.value`'s optionality. The generated file's typecheck proves
  the schema fits inside the written types, not the reverse: test/types.ts pins
  them field by field with `Equal`. One name declared twice, per kind, fails
  generation.
- **`test/generated.ts` is generated and typechecked.** Never edit it: `bun
  run --cwd packages/graphql-codegen-zod generated:write` regenerates it, and
  a spec fails, naming that command, when it is stale. Biome skips it.
- **The real scalar record is a parity target too.** `@nxgt/graphql-scalars`
  is a devDependency only (`workspace:^`), never a dependency: the plugin
  reads it by name at generation. `test/generated-scalars.ts` covers each of
  its scalars, alone and in a list; `real-scalars.spec.ts` checks every key
  is mapped and that the client takes, refuses and decodes what a server with
  `scalarResolvers` does (codecs to `Date` and `bigint` included).
- **`@nxgt/zod` is the client's record, at parity.** A devDependency only,
  never a dependency. `nxgt-zod.spec.ts` checks its `scalarSchemas` has the
  keys of `@nxgt/graphql-scalars`', in order; that each scalar takes, refuses
  and decodes every probe as the scalars package does (each scalar takes at
  least one probe, so none is only refused); and that `scalarSchemas:
  '@nxgt/zod'` generates the same file with only the import changed.
- **A default is `.prefault(v)` then `.nullable()`:** optional on the way in
  (`z.input`), present on the way out (`z.output`); `test/types.ts` pins it.
  `.default` would not run a nested input's own defaults, and `.nullish()`
  before `.prefault` would keep `undefined` in the output type.
- **Names follow the typescript plugins**
  (`@graphql-codegen/visitor-plugin-common`'s `convertFactory`): `Args` is
  `convert(parent + convert(field) + 'Args')`, variables `convert(name + suffix
  + 'Variables')`, a result `convert(name + suffix)`, a fragment `convert(name +
  fragment suffix)`, the suffix following
  `omitOperationSuffix`/`dedupeOperationSuffix`. Read that code before changing
  a name.

## The green bar

```sh
bun install
bunx biome ci
bun run build            # before typecheck: every `exports` points at dist/
bun run typecheck        # packages and scripts
bun run test
bun run verify:artifacts # packs, installs and imports every declared subpath
bun run changeset:status # on a branch cut from develop
```

CI runs the same, in this order, with no service container. Its "Newest
peers" job runs `scripts/newest-peers.ts`, deletes `bun.lock`, installs and
runs build, typecheck, test and `verify:artifacts` again against the newest
end of every peer range: graphql 17, the latest zod 4 and TypeScript 7. A spec
that drives TypeScript's compiler API imports TypeScript 6 as `typescript-api`
(TypeScript 7 has no compiler API). It resolves without
a lockfile, so an upstream release can turn it red with no change here: read
it, do not make it a required check. `.github/workflows/newest-peers.yml` runs
the same job weekly (Mondays 06:00 UTC) and on demand (`workflow_dispatch`),
so an upstream release is seen without waiting for a pull request.

**Before a release, or when a new zod 4.x (or graphql 17, TypeScript 7)
appears, the newest-peers run must pass**, `another-zod.spec.ts` and
`marked.spec.ts` included: run the workflow from the Actions tab, or locally
`bun scripts/newest-peers.ts && rm bun.lock && bun install`, then build,
typecheck, test and `verify:artifacts`, and restore with `git checkout -- .
&& bun install`. A zod upgrade also re-runs the `rewrites` audit.

## Traps

- **A rule of a scalar is changed in softistx/nxgt-zod, not here.** The
  schemas are `@nxgt/zod`'s: a fix is a PR there, a publish, then bumping
  the `@nxgt/zod` range in `packages/graphql-scalars/package.json` (and
  `bun install`). A spec here that expects the new behaviour stays red until
  the bump; the scalar's options (name, description, `specifiedByURL`,
  `literals`) and `zodScalar` stay here.
- **graphql 17 types `parseLiteral` with two parameters.** A spec that calls
  `scalar.parseLiteral(node)` typechecks on 16 and fails `tsc` on 17; pass
  `undefined` for the variables. Only the "Newest peers" job sees it.
- **Source imports carry no extension** (`'./scalars'`, never
  `'./scalars.js'`). `build.ts` adds the `.js` to the emitted `.d.ts`, so a
  consumer under `bundler` and one under `nodenext` both resolve them; a
  failure only under `nodenext` (TS2305) is a bug, which `verify:artifacts`
  catches.
- **Every package is public.** No package carries `"private": true`, not
  even before its first release; see the divergences below. What publishes
  is the merge of a "Version packages" pull request on `develop`, and a
  package with no changeset is not in it.
- **The skeleton is nxgt-data's.** The shared root files are byte-for-byte
  copies; fix a drift in nxgt-data first. The `diff` loop is in the
  `nxgt-monorepo:lay-out-a-library-monorepo` skill.
- **A build that exits 0 is not evidence the artifact loads.**
  `bun run verify:artifacts` packs every package, installs the tarballs as a
  consumer does, and runs the stages of `scripts/artifacts/`, stopping at the
  first that fails. nxgt-data's AGENTS.md describes each stage; an unbuilt
  package stops at the first with `<package>: no dist/`, and a stale one with
  `src/ is <n>s newer than dist/`. `test/declarations/<package>.ts`
  (`scalars.ts`, `validation.ts`) is what `emit.ts` emits under a consumer's
  strict settings: an exported value whose
  inferred type names something the entry does not export fails there with
  TS2883. Each fixture is checked twice, under `bundler` and under
  `nodenext`: `build.ts` gives every relative import of an emitted `.d.ts`
  its `.js` (or `/index.js`), since tsc keeps the sources' extensionless
  `./scalars`, and a consumer resolving as Node does then loses every name
  re-exported through it (TS2305), while `bundler` sees nothing wrong.
  `dts-imports.ts` skips an import written in a comment (a JSDoc example),
  and `build.ts` then checks each declaration with `declarationSpecifiers`,
  failing on a relative import still without an extension. Both came back
  from nxgt-data (softistx/nxgt-data#197), which holds the same three files.

- **A source folder named `build`, `dist`, `coverage` or `node_modules` is out
  of `bun run typecheck`.** `tsconfig.base.json` excludes `**/build` and the
  rest, and a package's `tsconfig.json` has no `include`: such a folder's files
  are checked only when something imports them, and a spec there by nothing
  (the declaration build excludes specs). Only the build then sees a type
  error. Do not name a source folder after them (`src/builder/`, not
  `src/build/`); the cure, dropping `**/build` from the base, starts in
  nxgt-data, whose file this is.

## Deliberate duplication: do not "clean this up"

| Kept twice | Why |
| --- | --- |
| `LICENSE`, at the root and in each `packages/*/` | npm ships only the `LICENSE` in the package's own directory. `verify:artifacts` fails a tarball without one. Change them all together |
| `bunfig.toml`, `.gitignore`, `LICENSE`, `tsconfig.base.json`, `tsconfig.json`, `scripts/tsconfig.json`, `build.ts`, `biome.json` | byte copies of nxgt-data's: each repository releases on its own. Fix a drift in nxgt-data first, then carry it here |
| `scripts/artifacts/` (every module and spec), `scripts/verify-artifacts.ts` | nxgt-data's, byte for byte except two lines (see below). A check added to one copy belongs in the others; nxgt-data's AGENTS.md lists where each copy stands |
| `scripts/workspace.ts`, `scripts/publish.ts` and their specs | byte copies of nxgt-data's (alxia's originally) |
| `scripts/newest-peers.ts`, its spec, and the "Newest peers" job in `ci.yml` | byte copies of nxgt-data's script and spec; the job is nxgt-data's without its four server caches and `REDISMS_DISABLE_POSTINSTALL`, and its comment names TypeScript 7, which these peers accept. The script reads `examples/*` too, which matches nothing here |
| The "Newest peers" job, in `ci.yml` and in `.github/workflows/newest-peers.yml` | this repository's own: the second file runs the job weekly and on `workflow_dispatch` and adds a step listing the resolved peers; it is a separate workflow so `ci.yml` stays nxgt-data's job and the `ci` job never runs on a schedule. A step changed in one is changed in the other. nxgt-data has no scheduled run |
| `.github/actions/setup/action.yml`, `.github/workflows/release.yml`, `.github/workflows/deprecate.yml`, the `ci` job of `ci.yml` | nxgt-di's, which are nxgt-data's without its servers (`deprecate.yml` is nxgt-telemetry's) |
| `CLAUDE.md`, `.claude/settings.json` | nxgt-di's, byte for byte |
| `src/cli.ts` and `src/typedefs-command.ts` in `graphql-scalars` and `graphql-validation` | each package ships its own `typedefs` bin and no package depends on the other. `cli.ts` is the same file apart from its doc comment; `typedefs-command.ts` shares `--out` and `--help`, the usage layout, the exit codes and `--help`. A change to one bin's flags or exit codes is made in the other |
| The 65 scalar names (GraphQL names and `<name>Schema` exports) | copied outside this repository: `@nxgt/typespec` (softistx/nxgt-http) declares each as a TypeSpec scalar and OpenAPI component of the same name, with `x-nxgt-scalar: <Name>`, and pins the list in its `test/scalars/index.ts` (`GRAPHQL_SCALARS`); the rules are no longer copied: they live in `@nxgt/zod` (softistx/nxgt-zod), whose schemas this package re-exports, the same instances. Adding or renaming a scalar means a PR in `@nxgt/zod` first and the same change in `@nxgt/typespec`: tell the session or open the PR in each |

## Declared divergences from nxgt-data

- **Packages are public from the start**: no `"private": true`, against the
  skill's rule that a new package starts private. The owner decided that the
  repository and its packages are public; the first release still waits for
  the owner's go-ahead, since it is the merge of a Version PR.
- `ci.yml` has no service caches and does not run on `push` to `develop`
  (nothing is cached). The timeouts are 15 minutes, against nxgt-data's 25.
- `.github/workflows/newest-peers.yml`, the "Newest peers" job on a weekly
  schedule and `workflow_dispatch`, which nxgt-data does not have.
- No `check-nxgt-versions`, `meilisearch`, `redis` or `seaweedfs` scripts, and
  no `nxgt-versions.yml`: they serve nxgt-data's servers and packages.
- No `examples/` workspace.
- The artifact probe and the verify temp folder are named `nxgt-graphql-*`
  (`scripts/artifacts/install.ts`, `scripts/verify-artifacts.ts`), not
  `nxgt-data-*`, as nxgt-di and nxgt-telemetry do. These are the only two
  lines in `scripts/` that differ from nxgt-data's (`cmp`).
