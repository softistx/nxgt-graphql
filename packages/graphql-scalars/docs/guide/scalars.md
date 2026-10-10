# Scalars

The scalars of the package, grouped by category, the exact rule of each, and how
to put them in a schema. For your own scalars see [Custom
scalars](custom-scalars.md).

## The smallest example

```ts
import { graphql, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { DateTimeScalar } from '@nxgt/graphql-scalars';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      next: {
        type: DateTimeScalar,
        args: { at: { type: DateTimeScalar } },
        resolve: (_, args: { at: Date }) => new Date(args.at.getTime() + 1000),
      },
    },
  }),
});

const result = await graphql({
  schema,
  source: '{ next(at: "2024-01-01T01:00:00+01:00") }',
});
// { data: { next: '2024-01-01T00:00:01.000Z' } }
```

## Every scalar

Every scalar checks its value both ways: an input is validated before your
resolver sees it, a result before it goes on the wire.

Scalars live in categories, and the page follows them. A scalar `X` is
exported as `XScalar`, its Zod schema as `xSchema`, and that schema is also
`schemas.x`.

| Category | Scalars |
| --- | --- |
| [date-time](scalars/date-time.md) | `DateTime`, `Timestamp`, `Date`, `Time`, `LocalTime`, `LocalDateTime`, `Duration`, `UtcOffset`, `TimeZone` |
| [encoding](scalars/encoding.md) | `Base64`, `Base64URL`, `Hexadecimal`, `JWT`, `SHA256`, `SHA512` |
| [identifier](scalars/identifier.md) | `UUID`, `UUIDv4`, `UUIDv7`, `GUID`, `ULID`, `Cuid2`, `NanoID`, `KSUID`, `XID`, `ObjectID`, `ISBN`, `SemVer` |
| [color](scalars/color.md) | `HexColorCode`, `RGB`, `RGBA`, `HSL`, `HSLA` |
| [finance](scalars/finance.md) | `IBAN`, `Currency` |
| [geo](scalars/geo.md) | `Latitude`, `Longitude` |
| [locale](scalars/locale.md) | `CountryCode`, `Locale` |
| [network](scalars/network.md) | `URL`, `EmailAddress`, `IPv4`, `IPv6`, `IP`, `CIDRv4`, `CIDRv6`, `MAC`, `Hostname`, `PhoneNumber` |
| [number](scalars/number.md) | `PositiveInt`, `NegativeInt`, `NonNegativeInt`, `NonPositiveInt`, `PositiveFloat`, `NegativeFloat`, `NonNegativeFloat`, `NonPositiveFloat`, `SafeInt`, `Port`, `Long`, `BigInt` |
| [string](scalars/string.md) | `NonEmptyString`, `Emoji` |
| [value](scalars/value.md) | `JSON`, `JSONObject`, `Void` |


## Signatures

```ts
// every scalar has this shape, `X` being its GraphQL name
const XScalar: ZodScalar<typeof xSchema, 'X'>; // GraphQLScalarType<Output, Input>
// DateTime: GraphQLScalarType<Date, string>; Timestamp: <Date, number>;
// Long, BigInt: <bigint, string | number>;
// the number scalars (PositiveInt, Port, …), Latitude, Longitude: <number, number>;
// JSON, JSONObject: <unknown, unknown> (checked as JSON); Void: <null, null>;
// the others: <string, string>

// every scalar, keyed by its GraphQL name
type ScalarResolvers = { DateTime: typeof DateTimeScalar /* , Date, ... */ };
type ScalarName = keyof ScalarResolvers;
// every schema, keyed by its export name without `Schema`
type Schemas = { dateTime: typeof dateTimeSchema /* , date, ... */ };
// the same schemas, keyed by GraphQL name
type ScalarSchemas = { DateTime: typeof dateTimeSchema /* , Date, ... */ };

const scalarResolvers: ScalarResolvers;
const schemas: Schemas;
const scalarSchemas: ScalarSchemas;
const scalarTypeDefs: string; // one `scalar X @specifiedBy(...)` line per scalar

// graphql-codegen's `scalars` config, keyed and ordered as `scalarResolvers`
type CodegenScalar = { readonly input: string; readonly output: string };
type CodegenScalars = { readonly [N in ScalarName]: CodegenScalar };
const codegenScalars: CodegenScalars; // server: input z.output, output z.output | z.input
const clientCodegenScalars: CodegenScalars; // client: output z.input, input z.input plus Date
```

`scalarTypeDefs`, `scalarResolvers`, `scalarSchemas` and `schemas` list the
scalars in the code-unit order of their names, not a dictionary's: every
upper-case letter sorts before every lower-case one. `scalarTypeDefs`,
`scalarResolvers` and `scalarSchemas` follow the `…Scalar` export names
(`HSLA` before `HSL`, `HSL` before `HexColorCode`); `schemas` follows the
`…Schema` names (`hsl` before `hsla`).

A scalar with a standard behind it has a `specifiedBy` pointing at it (RFC 3339
for `DateTime`, the WHATWG URL standard for `URL`, RFC 4291 for `IPv6`); the
category pages name the exports and rules of each, and the SDL of
`scalarTypeDefs` shows which have one.

## The SDL as a file

`scalarTypeDefs` is a string, so an IDE's GraphQL plugin, which reads `.graphql`
files, reports `Unknown type "DateTime"`, and so does a server that scans
files. The package ships the SDL of every scalar as
`node_modules/@nxgt/graphql-scalars/graphql/scalars.graphqls`, exactly what
`nxgt-graphql-scalars typedefs` prints, and a spec fails when it drifts from
`scalarTypeDefs`. List it in `graphql.config.yml`:

```yaml
schema:
  - src/**/*.graphql
  - node_modules/@nxgt/graphql-scalars/graphql/scalars.graphqls
```

If your IDE does not index `node_modules`, or you want the file committed with
your schema, write it into the project (Node or Bun):

```sh
bunx nxgt-graphql-scalars typedefs --out schema/scalars.graphqls
bunx nxgt-graphql-scalars typedefs --out                     # generated/graphql/scalars.graphqls
bunx nxgt-graphql-scalars typedefs DateTime URL --out        # only those two
```

| Command line | Does |
| --- | --- |
| `typedefs` | prints every scalar |
| `typedefs <Name>...` | prints those only, as `pickScalars(...names).typeDefs` does; an unknown name exits 2 with `pickScalars: no scalar is named "<name>". The names are …`, then the usage |
| `--out [<file>]` | writes instead of printing, creating the folder; with no file, `generated/graphql/scalars.graphqls` relative to the current directory. The names come before it: `--out DateTime` is refused |
| `--help`, `-h` | shows the usage, anywhere on the line |

It exits 0 when done, 1 when the file cannot be written (`typedefs failed:
<message>` on stderr), and 2 on a usage error (`Unknown command "<x>".`,
`Unexpected arguments: …`, an unknown scalar, or `No command.`). Regenerate the
file after upgrading the package. A formatter (Biome, Prettier) run over the
copy wraps its long `@specifiedBy` lines: still the same SDL, but no longer
byte for byte what `typedefs` prints, so leave the copy out of it.

Each scalar must be declared once. Pick one source for the server:

- **The generated copy replaces the import.** A server that loads its type
  definitions by scanning `*.graphql(s)` files, with the copy among them,
  already declares the scalars: do not add `scalarTypeDefs` (keep
  `scalarResolvers`; the resolvers bind by name).
- **The import stays.** `scalarTypeDefs` declares them, and the copy serves the
  IDE only: keep it out of the folders the server scans, or exclude it from
  the glob.

Using both declares every scalar twice, and the schema fails to build with
`There can be only one type named "DateTime".`

## Schema-first with a server

Declare once with `scalarTypeDefs`, bind with `scalarResolvers`; spread both
whole, so every scalar a resolver names is declared. To declare only some, use
[`pickScalars`](#pickscalars).

```ts
import { createSchema } from 'graphql-yoga';
import { scalarTypeDefs, scalarResolvers } from '@nxgt/graphql-scalars';

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    ${scalarTypeDefs}
    type Query {
      user(id: UUID!): User
    }
    type User {
      id: UUID!
      email: EmailAddress!
      homepage: URL
      joined: DateTime!
    }
  `,
  resolvers: {
    ...scalarResolvers,
    Query: {
      user: (_, args: { id: string }) => ({
        id: args.id,
        email: 'ada@example.com',
        homepage: null,
        joined: new Date(),
      }),
    },
  },
});
```

## pickScalars

`pickScalars(...names)` returns the SDL and the `resolvers` entries of the
named scalars only, for a schema-first server that does not want every scalar
in its SDL.

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('UUID', 'EmailAddress');

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Query {
        owner(id: UUID!): EmailAddress
      }
    `,
  ],
  resolvers: { ...resolvers, Query: { owner: () => 'ada@example.com' } },
});
```

```ts
function pickScalars<const N extends readonly ScalarName[]>(
  ...names: N
): {
  readonly typeDefs: string;
  readonly resolvers: Pick<ScalarResolvers, N[number]>;
};
```

| Call | Result |
| --- | --- |
| `pickScalars('DateTime', 'URL')` | `typeDefs` is `scalar DateTime @specifiedBy(...)` and `scalar URL @specifiedBy(...)`, in the order given; `resolvers` has those two keys |
| `pickScalars()` | `{ typeDefs: '', resolvers: {} }` |
| `pickScalars('URL', 'URL')` | `URL` declared once |
| `pickScalars('Datetime')` | does not compile (`TS2345`): not a `ScalarName` |
| a name that got past the compiler | throws `TypeError: pickScalars: no scalar is named "Datetime". The names are Base64, Base64URL, BigInt, ….` |

`resolvers` is typed by the names you pass, so `resolvers.URL` exists and
`resolvers.UUID` does not. Declare in your own SDL only the scalars you
picked: a field typed with another one fails when the schema is built.

## The same rules outside GraphQL

Each scalar's Zod schema is exported on its own, named in its section of its
category's page (`dateTimeSchema` is a codec between the wire string and a
`Date`), and `schemas` holds them all under the name without `Schema`:
`schemas.dateTime` is `dateTimeSchema`.

```ts
import { z } from 'zod';
import { emailAddressSchema, schemas } from '@nxgt/graphql-scalars';

emailAddressSchema.parse('ada@example.com'); // 'ada@example.com'

const body = z.object({
  email: schemas.emailAddress,
  site: schemas.url.optional(),
  at: schemas.dateTime,
});

const parsed = body.parse({
  email: 'ada@example.com',
  at: '2024-03-10T12:00:00Z',
}); // parsed.at is a Date
```

The schemas come from [`@nxgt/zod`](https://www.npmjs.com/package/@nxgt/zod),
this package's one dependency: `import { uuidSchema } from '@nxgt/zod'` (or
`@nxgt/zod/scalars`) gives the very same schema, `===` to this package's,
without `graphql`. A change to a rule is made there.

### Keyed by GraphQL name

`scalarSchemas` holds the same schemas under the GraphQL name, which is what
code generated from a GraphQL schema knows: `scalarSchemas.DateTime` is
`dateTimeSchema`. Each entry is the very schema the scalar checks, typed
exactly (not `z.ZodType`), so `z.decode(scalarSchemas.X, wire)` gives what a
resolver receives, `z.input` is the wire type and `z.output` the resolver's.
For a codec (`DateTime`, `Timestamp`, `Long`, `BigInt`) they differ. Every
scalar has one, `JSON` and `Void` included. A scalar carries its schema too,
as `.schema`, your own `zodScalar` ones included — the instance `zodScalar`
returns, not a type rebuilt from its config (`toConfig()`,
`lexicographicSortSchema`, graphql-tools' `mapSchema`), which has none: read
`scalarSchemas[name]` there.

```ts
import { z } from 'zod';
import { scalarSchemas } from '@nxgt/graphql-scalars';

const Event = z.object({
  id: scalarSchemas.UUID,
  at: scalarSchemas.DateTime,
});

z.decode(Event, { id: crypto.randomUUID(), at: '2024-03-10T12:00:00Z' });
// { id: '…', at: Date }
```

## Types for graphql-codegen

graphql-codegen types an unknown scalar as `any`. `codegenScalars` and
`clientCodegenScalars` give its `scalars` config for every scalar here, so
the generated types are the real ones.

```ts
// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';
import { clientCodegenScalars, codegenScalars } from '@nxgt/graphql-scalars';

const config: CodegenConfig = {
  schema: 'src/schema.graphqls',
  generates: {
    'src/generated/resolvers.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: { scalars: codegenScalars },
    },
    'src/generated/operations.ts': {
      documents: 'src/**/*.graphql',
      plugins: ['typescript', 'typescript-operations'],
      config: { scalars: clientCodegenScalars },
    },
  },
};

export default config;
```

Each entry is `{ input: string; output: string }`: the TypeScript type as
text, read from the scalar's schema. A spec holds every entry to the type tsc
gives `z.input` and `z.output`, so the maps cannot drift. Only some entries
are not `string`:

| Scalars | Server input | Server output | Client input | Client output |
| --- | --- | --- | --- | --- |
| `DateTime` | `Date` | `Date \| string` | `string \| Date` | `string` |
| `Timestamp` | `Date` | `Date \| number` | `number` | `number` |
| `Long`, `BigInt` | `bigint` | `bigint \| string \| number` | `string \| number` | `string \| number` |
| the number scalars, `Latitude`, `Longitude` | `number` | `number` | `number` | `number` |
| `JSON`, `JSONObject` | `unknown` | `unknown` | `unknown` | `unknown` |
| `Void` | `null` | `null` | `null` | `null` |
| the others | `string` | `string` | `string` | `string` |

### On a server

`codegenScalars` is for `typescript-resolvers`. `input` is what a resolver
receives, the decoded `z.output`. `output` is what it may return: the decoded
value or the wire form, each once (`serialize` takes both, see
[`DateTime`](scalars/date-time.md#datetime)).

### On a client

`clientCodegenScalars` is for `typescript-operations`. `output` is a result as
it crosses the wire, the `z.input`. `input` is a variable: the `z.input`, plus
`Date` where the scalar takes a `Date`'s JSON form. A `Date` variable
serializes to an ISO string, so `DateTime` takes `string | Date`.

A client that decodes with `@nxgt/graphql-codegen-zod` gets its `Date` from
the Zod schemas. The plain `typescript-operations` types stay wire types.

`codegen.ts` runs on Node or Bun and imports the package root. That loads
`graphql`, `zod` and `@nxgt/zod` (a dependency of this package). A client
project that does not otherwise use `@nxgt/graphql-scalars` installs it and
`zod` as dev dependencies:

```sh
bun add -d @nxgt/graphql-scalars zod
```

A codegen project already has `graphql` and `typescript`, which are peers too
(see [the README](../../README.md#install) for the ranges).

### With scalars of your own

Spread the map and add yours. A scalar you leave out is `any` in the output,
as graphql-codegen does for any unknown scalar.

```ts
import { codegenScalars } from '@nxgt/graphql-scalars';

const scalars = {
  ...codegenScalars,
  Money: { input: 'number', output: 'number' },
};

// config: { scalars }
```

Next: [Custom scalars](custom-scalars.md), or [Migrating from
graphql-scalars](migrating-from-graphql-scalars.md).
