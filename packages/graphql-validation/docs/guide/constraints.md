# Constraints

How to declare checks with `@constraint` and turn them on with
`withValidation`. For the error an invalid input becomes, see
[Errors](errors.md).

## Smallest complete example

```ts
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { constraintTypeDefs, withValidation } from '@nxgt/graphql-validation';

const schema = withValidation(
  makeExecutableSchema({
    typeDefs: [
      constraintTypeDefs,
      /* GraphQL */ `
        type Query {
          greet(name: String! @constraint(minLength: 2)): String
        }
      `,
    ],
    resolvers: { Query: { greet: (_, { name }) => `Hello ${name}` } },
  }),
);

const result = await graphql({ schema, source: '{ greet(name: "A") }' });
// result.errors[0].message:
//   "Invalid arguments for Query.greet. name: Too small: expected string to have >=2 characters"
```

## The flow

1. Put `constraintTypeDefs` in your type definitions. It is a string: the SDL
   of the `@constraint` directive.
2. Write `@constraint(...)` on arguments and input fields.
3. Build the schema: `buildSchema`, `makeExecutableSchema`, GraphQL Yoga,
   Apollo Server, anything that builds from type definitions.
4. Attach every resolver, then call `withValidation(schema)` **last**: a
   resolver set on a field afterwards replaces the check.

```ts
import { buildSchema } from 'graphql';
import { constraintTypeDefs, withValidation } from '@nxgt/graphql-validation';

const schema = buildSchema(`${constraintTypeDefs}
  type Query { code(value: String @constraint(pattern: "^[A-Z]{3}$")): String }
`);
// ... set field resolvers on `schema` here ...
withValidation(schema);
```

What `withValidation` does:

- It wraps the resolver of every field that has a constrained argument, directly
  or anywhere inside an input type it takes: `subscribe` for a subscription
  field, `resolve` otherwise.
- It wraps in place and returns the same schema, typed as you passed it.
  Calling it twice wraps nothing twice.
- The resolver receives the parsed arguments (`z.output` of the schema the
  directives describe). An argument or input field the client left out stays
  **absent** from them, not `undefined`: `{ input: { email } }`, with
  `Object.keys(input)` equal to `['email']`. A `@oneOf` input keeps its one key.
- Each issue it raises carries `constraint`, the `@constraint` argument that
  refused (see [Errors](errors.md#the-error)).
- A default value that breaks its own constraint throws at the call, naming
  the place: `The default value of Query.a(name:) breaks its @constraint: Too
  small: expected string to have >=2 characters`. It works for arguments and
  input fields (`The default value of Page.size breaks ...`).
- It builds every schema once, at the call, so a constraint that cannot apply
  throws then, with the place named, not on the first request. This includes
  constraints in input types no argument reaches.
- A subscription field is checked once, in `subscribe`, before it starts, not
  on every event.

```ts
import type { GraphQLSchema } from 'graphql';
import type { FormatSchemas } from '@nxgt/graphql-validation';

declare function withValidation<S extends GraphQLSchema>(
  schema: S,
  options?: { formats?: FormatSchemas }, // your own formats, below
): S;
declare const constraintTypeDefs: string;
```

The directives are read from the SDL. A **code-first** schema does not declare
`@constraint`, so `withValidation` throws `this schema declares no @constraint
directive`. A schema that declares it but whose constrained types and fields
have no SDL (built with `new GraphQLObjectType`, or from merged pieces) is not
checked, and nothing says so.

## The `@constraint` arguments

They are those of [graphql-constraint-directive](https://github.com/confuser/graphql-constraint-directive),
minus `uniqueTypeName`. A rule narrows the type it names; on any other type the
schema fails to build (see [Troubleshooting](../troubleshooting.md)).

| Argument | GraphQL type | Applies to | Zod equivalent |
| --- | --- | --- | --- |
| `format` | `String` | `String`, `ID` | the schema of the [format](#formats), applied first |
| `minLength` | `Int` | `String`, `ID` | `.min(n)` |
| `maxLength` | `Int` | `String`, `ID` | `.max(n)` |
| `startsWith` | `String` | `String`, `ID` | `.startsWith(s)` |
| `endsWith` | `String` | `String`, `ID` | `.endsWith(s)` |
| `contains` | `String` | `String`, `ID` | `.includes(s)` |
| `notContains` | `String` | `String`, `ID` | `.refine(...)`, message `Must not contain "s"` |
| `pattern` | `String` | `String`, `ID` | `.regex(new RegExp(p))` |
| `min` | `Float` | `Int`, `Float` | `.gte(n)` |
| `max` | `Float` | `Int`, `Float` | `.lte(n)` |
| `exclusiveMin` | `Float` | `Int`, `Float` | `.gt(n)` |
| `exclusiveMax` | `Float` | `Int`, `Float` | `.lt(n)` |
| `multipleOf` | `Float` | `Int`, `Float` | `.multipleOf(n)` |
| `minItems` | `Int` | a list | `.min(n)` on the array |
| `maxItems` | `Int` | a list | `.max(n)` on the array |

An `Int` is also checked to be an integer. Several arguments combine:

```graphql
input Product {
  sku: String! @constraint(startsWith: "SKU-", maxLength: 12, pattern: "^SKU-[0-9]+$")
  price: Float! @constraint(exclusiveMin: 0, multipleOf: 0.01)
}
```

The directive must be the one `constraintTypeDefs` declares. A `@constraint`
declared otherwise, typically graphql-constraint-directive's SDL kept after a
migration, makes `withValidation` throw at startup: `This schema's @constraint
is not constraintTypeDefs': it is allowed on FIELD_DEFINITION; declares
uniqueTypeName, which no rule reads. Declare it with constraintTypeDefs.` An
argument of another type is named too (`declares minLength: String, not Int`).
See [Troubleshooting](../troubleshooting.md).

`@constraint` is allowed on `ARGUMENT_DEFINITION` and `INPUT_FIELD_DEFINITION`
only. On an output field `buildSchema` fails with
`Directive "@constraint" may not be used on FIELD_DEFINITION.`, where
graphql-constraint-directive allows it: a resolver's result is the job of
output scalars, and a directive that checked nothing there would be a promise
broken in silence. Use [`@nxgt/graphql-scalars`](https://www.npmjs.com/package/@nxgt/graphql-scalars)
for that.

### Lists

`minItems` and `maxItems` apply to the list; every other rule applies to its
items. A nullable argument also accepts `null` and absence.

```graphql
type Query {
  # at least one tag, at most 5; each tag 1 to 20 characters
  search(tags: [String!]! @constraint(minItems: 1, maxItems: 5, minLength: 1, maxLength: 20)): [String!]
}
```

### Nested and recursive inputs

Constraints on input fields are found through any depth of input types, lists
of them, and recursive ones. The issue path says where:

```graphql
input Address { zip: String! @constraint(pattern: "^[0-9]{5}$") }
input SignUp { name: String, address: Address! }
type Mutation { signUp(input: SignUp!): Boolean }
```

A bad `zip` is reported at `['input', 'address', 'zip']`.

### Interfaces

An interface field is resolved by the objects that implement it, so a
`@constraint` on an interface field's argument must be written again, the same,
on each implementing object's field. If an object drops it or writes a
different one, `withValidation` throws at startup rather than let the argument
go unchecked, printing both.

```graphql
interface Named { name(style: String @constraint(maxLength: 5)): String }
type Person implements Named {
  name(style: String @constraint(maxLength: 5)): String
}
```

### Format first

`format` replaces the base string schema, and every other rule narrows it, so
the order you write them in does not matter:

```graphql
email: String! @constraint(maxLength: 12, format: "email")
# the email format, then at most 12 characters
```

## Formats

`@constraint(format: "...")` takes one of these names, or one of
[your own formats](#your-own-formats). Anything else fails at startup with
`Unknown @constraint format "siret". Known formats: byte, date, date-time,
email, ipv4, ipv6, uri, uuid.`, your own formats listed after these.

| Format | Zod schema | Accepts |
| --- | --- | --- |
| `byte` | `z.base64()` | base64 text |
| `date-time` | `z.iso.datetime({ offset: true })` | RFC 3339 with an offset: `2024-03-10T12:00:00Z`, `2024-03-10T12:00:00+02:00` |
| `date` | `z.iso.date()` | `YYYY-MM-DD`, a real day |
| `email` | `z.email()` | an email address |
| `ipv4` | `z.ipv4()` | a dotted IPv4 address |
| `ipv6` | `z.ipv6()` | an IPv6 address |
| `uri` | `z.url({ protocol: /^(https?\|ftp)$/ })` | an absolute `http`, `https` or `ftp` URL; the scheme is required |
| `uuid` | `z.uuid()` | an 8-4-4-4-12 UUID |

Where they differ from graphql-constraint-directive's (validator.js):

- `date-time` is the canonical form only: an uppercase `T` and `Z`, seconds
  present. A lowercase `t` or `z`, or a space for `T`, is refused.
- `uri` requires the scheme (`example.com` is refused) and nothing but `http`,
  `https` and `ftp` gets in: no `javascript:`, no `mailto:`.
- `uri` trims surrounding white space, as `z.url()` does: for
  `" https://a.com "` the resolver receives `"https://a.com"`, and a
  `maxLength` written after it counts the trimmed value. It is the one
  format whose value reaches the resolver changed; a client generated by
  `@nxgt/graphql-codegen-zod` checks the same trimmed value, so both agree.
  Your own formats cannot do this: a format that rewrites is refused.

## Your own formats

When no built-in format says it, write the format as a Zod string schema and
name it. Keep every format in one module, exported as one record:

```ts
// formats.ts
import { z } from 'zod';

export const formatSchemas = {
  // A French company number: 14 digits.
  siret: z.string().regex(/^\d{14}$/, 'Invalid SIRET: write its 14 digits'),
  // An address at your company only.
  'work-email': z.email().endsWith('@example.com', 'Use your work address'),
  // Any check Zod can write, as long as it changes nothing.
  'even-code': z
    .string()
    .refine((value) => value.length % 2 === 0, 'Invalid code: an even length'),
};
```

Hand the record to `withValidation`:

```ts
import { constraintTypeDefs, withValidation } from '@nxgt/graphql-validation';
import { buildSchema } from 'graphql';
import { formatSchemas } from './formats';

const schema = withValidation(
  buildSchema(/* GraphQL */ `
    ${constraintTypeDefs}
    input Company {
      siret: String! @constraint(format: "siret")
      contact: String @constraint(format: "work-email", maxLength: 64)
    }
    type Query { company(input: Company!): String }
  `),
  { formats: formatSchemas },
);
```

What a format of your own is:

- **A Zod string schema**: `z.string()` or a string format (`z.email()`,
  `z.uuid()`, …), narrowed with anything that keeps it a string schema
  (`.regex()`, `.min()`, `.endsWith()`, `.refine()`). Never a `.transform()`,
  a codec or `.optional()`: the resolver receives what the client sent, and a
  null or absent value is the field's type's business (`String` or `String!`),
  not the format's. A non-string schema is a type error, and refused at startup.
- **It never rewrites the value.** These keep a string schema but change
  the value it passes on, and are refused at startup:
  - `.trim()`, `.toLowerCase()`, `.toUpperCase()`, `.normalize()`,
    `.slugify()` and `.overwrite()`;
  - `z.url()`, `z.httpUrl()` and `.url()`, which trim the value and drop its
    tabs and newlines (`z.url({ normalize: true })` rewrites it whole);
  - `z.coerce.string()`, which turns `12345` into `"12345"` (a type error
    too: it takes `unknown`).

  The server checks the value as sent, while a client chaining `maxLength` on
  your schema would check the rewritten one, so the two would disagree on
  `" AB "` or `" https://a.com "`. Every other string format (`z.email()`,
  `z.uuid()`, `z.iso.datetime()`, …) only checks. Refuse what is not
  canonical instead:

  ```ts
  // not z.string().trim().toLowerCase()
  const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug: lowercase words joined by hyphens');
  // not z.url()
  const link = z.string().refine((value) => value.trim() === value && URL.canParse(value), 'Invalid URL');
  ```

  A custom `.check()` that sets `ctx.value` shows nothing in its definition,
  so startup cannot see it: the request it rewrites fails, naming the format
  (`The format "slug" rewrote the value it checked…`), as a bug in a resolver
  would, and the resolver is not called.

- **Narrowed like a built-in one.** `format` comes first and the other rules
  narrow it: `@constraint(format: "work-email", maxLength: 64)` is your schema,
  then at most 64 characters. A check of yours with `abort: true`
  (`.refine(…, { message, abort: true })`) stops the rules after it, on the
  server as in a generated client: only its issue is returned. Once an async
  check of your format is pending, the rules have already run on the server,
  so put an aborting check before any async one.
- **Its messages are yours.** A refusal reads as your schema writes it (the
  package's own messages never name the value; yours may, so keep the input
  out of them if your logs or clients should not see it). Every issue your
  schema raises carries `constraint: "format"`, whatever its Zod `code` — a
  `.regex()` inside your format is the format's refusal, not `pattern`'s:

  ```json
  { "path": ["input", "siret"], "message": "Invalid SIRET: write its 14 digits", "code": "invalid_format", "constraint": "format" }
  ```

- **Named in lowercase letters, digits and hyphens**, starting with a letter
  (`siret`, `work-email`, `iso-6346`). A built-in name (`email`, `uuid`, …)
  cannot be replaced: it is a type error, and refused at startup.
- **An async check stays async.** `withValidation` parses asynchronously, so a
  `.refine(async …)` works in a request, from this package's zod or another
  copy. It runs once per value, and when it rejects (`db down`) the operation
  fails with that error, as a resolver's would. A default value is checked
  at startup synchronously, so a field whose format is async cannot have a
  default: startup throws `The default value of Query.a(s:) cannot be checked
  at startup: the format "free" checks asynchronously, …`.

Call `withValidation` once, with every format. A second call on the same
schema wraps nothing when its record has the same names, each the very same
schema object (the same record, or a copy of it); otherwise it throws — other
names, another schema object for a name (even an identical one), or no
`formats` after a call with some, or the reverse — since the fields are already
checked against the first formats. Without `formats`, nothing changes.

[`@nxgt/graphql-codegen-zod`](https://www.npmjs.com/package/@nxgt/graphql-codegen-zod)
0.3 reads the same record (`config: { formatSchemas: './formats' }`): the
generated schemas import your formats and chain the other rules on them, so
the client refuses what the server refuses, with your messages.

## In your IDE

An IDE's GraphQL plugin does not run your server, so it does not know
`@constraint` and reports `Unknown directive "@constraint"`. Point
`graphql.config.yml` at the file the package ships (by path; it is not an
`exports` subpath, so do not `import` it):

```yaml
schema:
  - src/**/*.graphql
  - node_modules/@nxgt/graphql-validation/graphql/constraint.graphqls
```

To keep a copy in the project, for an IDE that does not index `node_modules` or
to commit it with your schema:

```sh
bunx nxgt-graphql-validation typedefs --out
```

and list `generated/graphql/constraint.graphqls` in `graphql.config.yml` in place of the
`node_modules/...` line.

`npx` works the same. `--out` alone writes `generated/graphql/constraint.graphqls`,
`--out <file>` writes `<file>`, creating the folder, and without it the SDL goes
to stdout (`--help` or `-h`, anywhere on the line, lists the flags). It exits 0 when done, 1 when the file
cannot be written (`typedefs failed: <message>` on stderr), and 2 on a usage
error (`Unknown command "<x>".`, `Unexpected arguments: …`, or `No command.`). Regenerate the file after upgrading the
package.

The schema must declare `@constraint` once. Pick one source for the server:

- **The generated file is part of your schema.** If the server loads its
  type definitions by scanning `*.graphql(s)` files and the copy sits among
  them, it already declares the directive: do not add `constraintTypeDefs`.
- **`constraintTypeDefs` declares it.** Then the copy is for the IDE only:
  keep it out of the folders the server scans (or exclude it from the glob).

Both give the same schema, and `withValidation` accepts either: it checks that
the directive declared is this package's. Both at once throw
`There can be only one directive named "@constraint".`

## A realistic schema

```ts
import { createYoga, createSchema } from 'graphql-yoga';
import { constraintTypeDefs, withValidation } from '@nxgt/graphql-validation';

const schema = withValidation(
  createSchema({
    typeDefs: [
      constraintTypeDefs,
      /* GraphQL */ `
        input Signup {
          email: String! @constraint(format: "email", maxLength: 254)
          password: String! @constraint(minLength: 12)
          website: String @constraint(format: "uri")
        }
        type Mutation {
          signup(input: Signup!): ID!
        }
        type Query { ok: Boolean }
      `,
    ],
    resolvers: {
      Mutation: {
        // runs only for a valid `input`
        signup: (_, { input }) => createUser(input),
      },
    },
  }),
);

declare function createUser(input: { email: string }): string;

export const yoga = createYoga({ schema });
```

For rules the directive cannot say, see [`validated`](errors.md#validated).
