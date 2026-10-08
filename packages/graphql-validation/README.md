# @nxgt/graphql-validation

Validate GraphQL arguments and input fields with `@constraint` directives
written in your schema. Each directive becomes a Zod schema that checks the
arguments before your resolver runs; an invalid input is one `BAD_USER_INPUT`
error that lists every reason with its path, so a form can show each one beside
its field. For schema-first servers on `graphql` 16 and 17 (`graphql-js`,
GraphQL Yoga, Apollo Server).

## Install

```sh
bun add @nxgt/graphql-validation graphql zod typescript
```

Peers, all **required**:

| Peer | Range |
| --- | --- |
| `graphql` | `^16.11.0 \|\| ^17.0.0` |
| `zod` | `>=4.6.5 <5` |
| `typescript` | `^6.0.3` |

Your `tsconfig.json` needs:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler" // `nodenext` is not supported
  }
}
```

## Usage

### Constrain arguments and input fields

Add `constraintTypeDefs` to your type definitions, write `@constraint(...)`,
build the schema with any schema-first builder (`buildSchema` from `graphql`,
or `makeExecutableSchema` from `@graphql-tools/schema` as below), then call
`withValidation(schema)` **last**, once every resolver is attached.

```ts
import { makeExecutableSchema } from '@graphql-tools/schema';
import { constraintTypeDefs, withValidation } from '@nxgt/graphql-validation';

const typeDefs = [
  constraintTypeDefs,
  /* GraphQL */ `
    input SignUp {
      email: String! @constraint(format: "email", maxLength: 254)
      age: Int @constraint(min: 18)
      tags: [String!] @constraint(maxItems: 5, maxLength: 20)
    }
    type Query {
      user(id: ID! @constraint(format: "uuid")): String
    }
    type Mutation {
      signUp(input: SignUp!): Boolean
    }
  `,
];

const resolvers = {
  Mutation: {
    // `input` is already checked: this only runs for a valid one
    signUp: (_: unknown, { input }: { input: { email: string } }) => {
      console.log(input.email);
      return true;
    },
  },
};

export const schema = withValidation(makeExecutableSchema({ typeDefs, resolvers }));
```

`withValidation` wraps, in place, the resolver of each field that has
something to check, and returns the same schema. A subscription field is
checked once, in `subscribe`. Calling it twice wraps nothing twice. A
constraint that cannot apply throws when you call it, not on the first
request. The resolver receives the parsed arguments.

Every argument, its rule and its Zod equivalent, and the formats, are in
[Constraints](docs/guide/constraints.md).

### Read the error

```json
{
  "errors": [
    {
      "message": "Invalid arguments for Mutation.signUp. input.email: Invalid email address",
      "path": ["signUp"],
      "extensions": {
        "code": "BAD_USER_INPUT",
        "issues": [
          { "path": ["input", "email"], "message": "Invalid email address", "code": "invalid_format", "constraint": "format" },
          { "path": ["input", "age"], "message": "Too small: expected number to be >=18", "code": "too_small", "constraint": "min" }
        ]
      }
    }
  ]
}
```

`issues[].path` is relative to the arguments, and `issues[].constraint` names the
`@constraint` argument that refused. Mapping issues to form fields is
in [Errors](docs/guide/errors.md).

### Rules a directive cannot say

`validated(schema, resolver)` checks the arguments with a Zod schema you write,
for rules across fields, refinements and async checks. It raises the same error.

```ts
import { validated } from '@nxgt/graphql-validation';
import { z } from 'zod';

const resolvers = {
  Query: {
    range: validated(
      z
        .object({ from: z.number(), to: z.number() })
        .refine(({ from, to }) => from <= to, {
          message: 'from must not exceed to',
          path: ['to'],
        }),
      (_, { from, to }) => to - from,
    ),
  },
};
```

## IDE support

An IDE's GraphQL plugin (JetBrains GraphQL, VS Code GraphQL) reads your `.graphql`
files, not `constraintTypeDefs`, so it reports `Unknown directive "@constraint"`.
The package ships the directive as a file; add it to your `graphql.config.yml`:

```yaml
schema:
  - src/**/*.graphql
  - node_modules/@nxgt/graphql-validation/graphql/constraint.graphqls
```

If your IDE does not index `node_modules`, or you want the file committed with
your schema, write it into the project (Node or Bun), and list that path instead:

```sh
bunx nxgt-graphql-validation typedefs --out
# or: npx nxgt-graphql-validation typedefs --out
```

`--out` alone writes `generated/graphql/constraint.graphqls`, `--out <file>` writes
`<file>`, and without `--out` the SDL is printed. Regenerate the file after upgrading the package.

The schema must declare `@constraint` once. Pick one source for the server:

- **The generated file is part of your schema.** If the server loads its
  type definitions by scanning `*.graphql(s)` files and the copy sits among
  them, it already declares the directive: do not add `constraintTypeDefs`.
- **`constraintTypeDefs` declares it.** Then the copy is for the IDE only:
  keep it out of the folders the server scans (or exclude it from the glob).

Both give the same schema, and `withValidation` accepts either: it checks that
the directive declared is this package's. Both at once throw
`There can be only one directive named "@constraint".`

## Exports

| Export | Is |
| --- | --- |
| `constraintTypeDefs` | the SDL of `@constraint`, to add to `typeDefs` |
| `withValidation(schema)` | checks every `@constraint` of a schema before its resolvers run |
| `validated(schema \| shape, resolver)` | a resolver whose arguments a Zod schema checks |
| `badUserInput(where, zodError)` | builds the error above, for code that validates by hand |
| `ValidationIssue`, `BadUserInputExtensions` | the types of `extensions.issues` and `extensions` |
| `ConstraintArgument` | the type of `issues[].constraint`: `'minLength' \| 'format' \| ...` |
| `ArgsSchema`, `SchemaOf` | the types `validated` accepts |

Also shipped, outside `exports`:

| File | Is |
| --- | --- |
| `graphql/constraint.graphqls` | the SDL of `@constraint` for IDEs; reference it by path, it is not importable |
| `nxgt-graphql-validation` (bin) | `typedefs [--out [<file>]]` prints or writes that SDL; `--help` |

## Traps

- `@constraint` is read from the SDL. A code-first schema does not declare the
  directive, so `withValidation` throws; one that declares it but whose
  constrained types and fields have no SDL (code-first, or merged pieces) is
  checked for nothing, and no error says so. Use type definitions.
- Call `withValidation` last: a resolver set on a field afterwards replaces
  the check.
- A `@constraint` on an interface field's argument must be repeated on each
  implementing object's field, or `withValidation` throws at startup.
- `@constraint` is refused on an output field:
  `Directive "@constraint" may not be used on FIELD_DEFINITION.`
- `format: "date-time"` takes the canonical RFC 3339 form only (uppercase `T`
  and `Z`, seconds present).

Every startup error and its fix is in [Troubleshooting](docs/troubleshooting.md).

## Documentation

- [Documentation index](docs/README.md)
- Guides: [Constraints](docs/guide/constraints.md), [Errors](docs/guide/errors.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md): a Zod codegen plugin, your own formats, schemas that read the context
