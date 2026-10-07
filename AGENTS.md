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
                           exported from the package (big-integer.ts)
```

- **A new scalar is a file, its spec, and one line** in its category's
  `index.ts`. A new category is a folder and one line in `all.ts`. Nothing is
  listed by hand anywhere else: `scalarResolvers`, `schemas` and
  `scalarTypeDefs` are derived from what `all.ts` exports, in the
  code-unit order of a module namespace (`IPv4` before `Iban`).
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
  the guard does not see it.
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
  variable's value to its own message: neither is ours to remove.
- **`DateTime` is an instant, `Date` is not.** `DateTime` requires an offset,
  resolves to a `Date` and serializes a `Date` only, in UTC. `Date` stays a
  `YYYY-MM-DD` string on both sides: a `Date` would shift it by a day in half
  the time zones.
- **`URL` is `http:` or `https:` only.** Zod's `z.url()` alone accepts
  `javascript:` (measured on zod 4.6.5), and a client is likely to put the
  value in an `href`. The pattern must stay exactly `/^https?$/`: Zod reads
  that source to also refuse `https:example.com`, and a spec pins it.
- **The `*Int` scalars are 32 bits**, as GraphQL's `Int` is; `SafeInt`,
  `Long` and `BigInt` are the wider ones, and say so in their name.
- **`Long` and `BigInt` are a string on the wire, always.** A `bigint` in the
  resolvers; as input a canonical decimal string or a safe-integer number. A
  number past 2⁵³ is refused, never rounded, and a resolver's `number` is
  refused rather than converted (`src/rules/big-integer.ts`).
- **An integer scalar reads literals as GraphQL's `Int` does**: a float
  literal (`1.0`, `1e3`) is refused, through `zodScalar`'s
  `literals: 'integer'`, and `-0` is refused by `src/rules/integer.ts`.
  `integerCases()` in `test/scalar-cases.ts` proves both for each one.
- **An input is taken in its canonical form only.** A scalar refuses a
  variant spelling rather than rewriting it (`007`, `-0`), so the value a
  resolver receives is the one the client sent. The exceptions are Zod's own
  (`URL` trims). Where a format has several spellings of one value that Zod
  accepts as they are (`IPv6`'s compressed and full forms in either case, `MAC` in either
  case), the scalar accepts them and passes them through unchanged: no
  rewrite, so nothing is silently normalised.
  `ObjectID` (24 hex digits) takes either case on the owner's decision, kept
  as sent. Where the format's own reference reads one case only (rs/xid's
  `XID`), the scalar takes that case only.

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
