# AGENTS.md

Instructions for any coding agent working in `nxgt-graphql`.

## What this repository is

GraphQL building blocks for applications built on the nxgt packages,
published to the public npm registry. The repository and every package in it
are public.

| package | what it is |
| --- | --- |
| `@nxgt/graphql-scalars` | GraphQL scalars whose every crossing is checked by one Zod schema: `zodScalar(schema, { name })` and the scalars built on it, by category (one page each under `docs/guide/scalars/`), with `scalarTypeDefs` and `scalarResolvers` for a schema-first server, `pickScalars(...names)` for some of them, and each schema (`dateTimeSchema`, or `schemas.dateTime`) for use outside GraphQL. Peers: `graphql`, `zod`, `typescript` |

A package here is named `@nxgt/graphql-<what>`: the `@nxgt` scope is shared
by every nxgt repository, and `scalars` alone would not say what it is for.

It is **Bun-first**: ESM, tested with `bun test`, no Bun-only API in the library.

## Layout

The package is laid out for a hundred scalars, not seven: adding one touches
one category and nothing else.

```
packages/graphql-scalars/src/
  zod-scalar.ts            the factory
  type-defs.ts             the SDL of a set of scalars
  pick-scalars.ts          pickScalars(...names)
  scalars/
    all.ts                 one `export *` line per category
    index.ts               derives scalarResolvers, schemas, scalarTypeDefs from all.ts
    registry.spec.ts       the guards below
    <category>/            date-time, identifier, network, number, string, ...
      index.ts             one `export *` line per scalar
      <name>.ts            one scalar: `<name>Schema`, then `<Name>Scalar`
      <name>.spec.ts       its cases, through test/scalar-cases.ts
                           (scalarCases; integerCases for an integer one)
  rules/                   building blocks several scalars share, never
                           exported from the package: base64.ts,
                           big-integer.ts, color.ts, date.ts, hostname.ts,
                           integer.ts, json.ts, offset.ts
```

- **A new scalar is a file, its spec, and one line** in its category's
  `index.ts`. A new category is a folder and one line in `all.ts`. Nothing is
  listed by hand anywhere else: `scalarResolvers`, `schemas` and
  `scalarTypeDefs` are derived from what `all.ts` exports, in the
  code-unit order of a module namespace (`IBAN` before `IP`, `HSLA` before
  `HSL`; `schemas` by the `…Schema` names, `hsl` before `hsla`).
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
  `zodScalar`, `pickScalars`, `scalarResolvers`, `schemas` or
  `scalarTypeDefs`.
- **The schema export ends in `Schema`.** `export *` lifts it to the package
  root, where a bare `url` or `date` would read as something else.

## Layering

`@nxgt/graphql-scalars` depends on nothing at runtime; `graphql` and `zod` are
peers, each pinned exactly as a devDependency at the oldest end of its range
(`graphql` `16.11.0`, `zod` `4.6.5`). `zod`'s range, `>=4.6.5 <5`, is
nxgt-data's (`@nxgt/mongo`, `@nxgt/redis`): one range is one zod in an
application's tree. Siblings, when there are some, depend on each other by
`workspace:^`.

## Invariants

Each of these is a promise in the public API, and a spec proves it. A change
that weakens one is a breaking change, even when every spec stays green.

- **graphql 16 and 17 both work.** `zodScalar` passes the legacy
  `serialize`/`parseValue`/`parseLiteral` (all graphql 16 calls) and the
  `coerceOutputValue`/`coerceInputValue`/`coerceInputLiteral` graphql 17
  calls in their place. The config is built in a variable, not passed as a
  literal, so graphql 16's config type does not refuse the names it lacks.
  The main CI job proves 16 (the lockfile), the "Newest peers" job 17.
- **One schema checks both ways.** An input is decoded (`z.safeDecode`), a
  resolver's result is encoded (`z.safeEncode`) and refused when it does not
  fit, rather than written to the wire as it is. A schema that changes a value
  must be a `z.codec`; a `.transform()` has no way back.
- **A refusal never names the value.** `<Name> cannot represent this input:
  <issue>` and `<Name> cannot serialize this value: <issue>`, with Zod's
  first issue only; no issue of a built-in schema contains the value
  (Zod's `received NaN` or `received Infinity` names a kind of number, not
  the input). A refused literal carries its node, so the client gets its location.
  What Zod throws rather than fails on (a `.transform()` on the way out, an
  async check, a codec's own error) is a `GraphQLError` too, the original as
  its `originalError`. A user schema's own issue can hold input (a custom
  message, `Unrecognized key`), and graphql 16 — not 17 — adds a bad
  variable's value to its own message: neither is ours to remove. Our own
  messages read `Invalid <format>[: hint]` (`Invalid URL: write the scheme
  lowercase`), the hint saying what to send, never what was sent.
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
  not `-00:00` (`src/rules/offset.ts`, shared with `Time` and `UtcOffset`),
  resolves to a `Date` and serializes a `Date` only, in UTC. The fraction is
  cut to three digits before `new Date` reads it, so no engine's own parser
  is involved, and an instant outside 0000-01-01 to 9999-12-31 UTC (what
  `toISOString()` writes as RFC 3339) is refused both ways. `Date` stays a
  `YYYY-MM-DD` string on both sides: a `Date` would shift it by a day in half
  the time zones.
- **`URL` is `http:` or `https:` only.** Zod's `z.url()` alone accepts
  `javascript:` (measured on zod 4.6.5), and a client is likely to put the
  value in an `href`. The pattern must stay exactly `/^https?$/`: Zod reads
  that source to also refuse `https:example.com`; the refines below refuse
  it too, so a spec reads the check's `protocol` source and pins it. On
  top of Zod: the scheme lowercase, then `//` and a host as written that is
  a `Hostname` (`src/rules/hostname.ts`), a canonical IPv4 or a bracketed
  IPv6 — never what only a URL parser reads as one (`https://123`,
  `https://0x7f.1`, `a_b.com`) — and an optional port with no leading zero;
  no user info (credentials in an `href` leak); no white space, control or
  invisible format character (`\p{Cf}`) anywhere. What a parser rewrites
  to an equivalent is kept as sent: an uppercase host, a default port
  (`:443`), dot segments, percent-escapes in the path. That check runs before `z.url()`, as a check of the
  same `z.string()` rather than a pipe, so it sees the value Zod would trim.
- **`PositiveInt`, `NegativeInt`, `NonNegativeInt` and `NonPositiveInt`
  are 32 bits**, as GraphQL's `Int` is. `SafeInt` (±(2⁵³ − 1)), `Long`
  (64 bits) and `BigInt` (unbounded) are not, and say so in their name.
- **`Long` and `BigInt` are a string on the wire, always.** A `bigint` in the
  resolvers; as input a canonical decimal string or a safe-integer number. A
  number past 2⁵³ is refused, never rounded, and a resolver's `number` is
  refused rather than converted (`src/rules/big-integer.ts`).
- **An integer scalar reads literals as GraphQL's `Int` does**: a float
  literal (`1.0`, `1e3`) is refused, through `zodScalar`'s
  `literals: 'integer'`, and so is `-0`: by the bound for `PositiveInt` and
  `NegativeInt`, by `src/rules/big-integer.ts` for `Long` and `BigInt`, by
  `src/rules/integer.ts` for the rest. `integerCases()` in
  `test/scalar-cases.ts` proves both for each one.
- **`TimeZone` is what the runtime's `Intl` knows, aliases included.** Node
  and Bun disagree on which name of a zone is canonical (Node turns
  `Asia/Kolkata` into `Asia/Calcutta`), so an alias is not refused, and the
  value is kept as sent. The case must be the zone's own; for an alias Node
  rewrites, that is a heuristic over each word's shape (`time-zone.ts`): it
  refuses no tzdata name, measured on Bun and Node, and on Node lets through
  a miscasing whose words still look like IANA words (`ASIA/Kolkata`,
  `ZULU`, `Prc`). Bun lets none through. An offset is
  `UtcOffset`'s, never a `TimeZone`.
- **`JSON` and `JSONObject` read every literal** (`literals: 'any'`), and
  refuse both ways what JSON cannot write back as it is: a cycle,
  `undefined`, a hole, a `Date`, `NaN`, `-0` (JSON writes it `0`), nesting
  past 1000 levels
  (`src/rules/json.ts`). A variable inside a literal is read as graphql 17's
  `replaceVariables` reads it, on 16 too (`untypedValue` in
  `zod-scalar.ts`, not graphql 16's `valueFromASTUntyped`): left out, it
  drops an object field and makes a list item `null`; validation sees every
  variable left out, on both. Two graphql 16 limits a scalar cannot fix: a
  variable of a custom scalar inside the literal arrives as its resolver
  value (a `Date`, so `JSON` refuses it; 17 passes its wire value), and an
  object or list *default* for a `JSON` argument makes introspection and
  `printSchema` throw (`Cannot convert value to AST`).
- **`Void` is `null` only.** GraphQL writes `null` without calling the
  scalar, so a resolver that returns nothing answers `null`; one that
  returns a value is refused, not silently dropped.
- **`Locale`'s canonical form is checked here, not taken from `Intl`.** V8
  rewrites every CLDR alias (`tl` → `fil`, `en-UK` → `en-GB`, and inside
  `-t-`: `en-t-iw` → `en-t-he`), JavaScriptCore only some, so comparing a
  tag, or its extensions, with `Intl.getCanonicalLocales` answered
  differently on Node and Bun. `Intl` only says whether the tag is
  well-formed, which both engines agree on; `locale.ts` checks the rest:
  the case before the first extension, then extensions all lowercase,
  singletons ascending (`-x-` ends the tag: what follows is private use),
  `-u-` attributes sorted before keywords sorted by key, each key once and
  never `-true`, `-t-` fields sorted by key. An alias is kept as sent,
  a value's alias too (`en-u-ca-islamicc`, `en-u-kb-yes`). Measured
  identical on Node and Bun over 118 tags.

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
end of every peer range: graphql 17 and the latest zod 4. It resolves without
a lockfile, so an upstream release can turn it red with no change here: read
it, do not make it a required check.

## Traps

- **graphql 17 types `parseLiteral` with two parameters.** A spec that calls
  `scalar.parseLiteral(node)` typechecks on 16 and fails `tsc` on 17; pass
  `undefined` for the variables. Only the "Newest peers" job sees it.
- **Imports carry no extension** (`'./scalars'`, never `'./scalars.js'`), and
  consumers resolve as a bundler does. A failure only under `nodenext` is not a
  bug.
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
  `src/ is <n>s newer than dist/`. `test/declarations/scalars.ts` is what
  `emit.ts` emits under a consumer's strict settings: an exported value whose
  inferred type names something the entry does not export fails there with
  TS2883.

## Deliberate duplication: do not "clean this up"

| Kept twice | Why |
| --- | --- |
| `LICENSE`, at the root and in each `packages/*/` | npm ships only the `LICENSE` in the package's own directory. `verify:artifacts` fails a tarball without one. Change them all together |
| `bunfig.toml`, `.gitignore`, `LICENSE`, `tsconfig.base.json`, `tsconfig.json`, `scripts/tsconfig.json`, `build.ts`, `biome.json` | byte copies of nxgt-data's: each repository releases on its own. Fix a drift in nxgt-data first, then carry it here |
| `scripts/artifacts/` (every module and spec), `scripts/verify-artifacts.ts` | nxgt-data's, byte for byte except two lines (see below). A check added to one copy belongs in the others; nxgt-data's AGENTS.md lists where each copy stands |
| `scripts/workspace.ts`, `scripts/publish.ts` and their specs | byte copies of nxgt-data's (alxia's originally) |
| `scripts/newest-peers.ts`, its spec, and the "Newest peers" job in `ci.yml` | byte copies of nxgt-data's script and spec; the job is nxgt-data's without its four server caches and `REDISMS_DISABLE_POSTINSTALL`. The script reads `examples/*` too, which matches nothing here |
| `.github/actions/setup/action.yml`, `.github/workflows/release.yml`, `.github/workflows/deprecate.yml`, the `ci` job of `ci.yml` | nxgt-di's, which are nxgt-data's without its servers (`deprecate.yml` is nxgt-telemetry's) |
| `CLAUDE.md`, `.claude/settings.json` | nxgt-di's, byte for byte |

## Declared divergences from nxgt-data

- **Packages are public from the start**: no `"private": true`, against the
  skill's rule that a new package starts private. The owner decided that the
  repository and its packages are public; the first release still waits for
  the owner's go-ahead, since it is the merge of a Version PR.
- `ci.yml` has no service caches and does not run on `push` to `develop`
  (nothing is cached). The timeouts are 15 minutes, against nxgt-data's 25.
- No `check-nxgt-versions`, `meilisearch`, `redis` or `seaweedfs` scripts, and
  no `nxgt-versions.yml`: they serve nxgt-data's servers and packages.
- No `examples/` workspace.
- The artifact probe and the verify temp folder are named `nxgt-graphql-*`
  (`scripts/artifacts/install.ts`, `scripts/verify-artifacts.ts`), not
  `nxgt-data-*`, as nxgt-di and nxgt-telemetry do. These are the only two
  lines in `scripts/` that differ from nxgt-data's (`cmp`).
