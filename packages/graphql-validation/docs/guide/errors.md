# Errors

The error an invalid input becomes, how a client reads it, and `validated` for
rules a `@constraint` cannot say. For declaring constraints, see
[Constraints](constraints.md). For an API that answers invalid input as one
400 error with a list of fields, see
[Answering invalid input as one error](invalid-input.md).

## The error

An invalid input is **one** `GraphQLError`, thrown before your resolver runs:

- `message`: `Invalid arguments for <Type>.<field>. <path>: <first issue message>`,
  for a log line. The path is dotted; `arguments` stands for an empty path.
- `extensions.code`: `BAD_USER_INPUT`, the code Apollo and most clients read.
- `extensions.issues`: every reason, not only the first.

```json
{
  "errors": [
    {
      "message": "Invalid arguments for Mutation.signUp. input.email: Invalid email address",
      "path": ["signUp"],
      "extensions": {
        "code": "BAD_USER_INPUT",
        "issues": [
          { "path": ["input", "email"], "message": "Invalid email address", "code": "invalid_format", "constraint": "format", "value": "email" },
          { "path": ["input", "name"], "message": "Too small: expected string to have >=2 characters", "code": "too_small", "constraint": "minLength", "value": 2 },
          { "path": ["input", "tags"], "message": "Too big: expected array to have <=2 items", "code": "too_big", "constraint": "maxItems", "value": 2 }
        ]
      }
    }
  ],
  "data": { "signUp": null }
}
```

The error's own `path` is the field; each issue's `path` is **relative to the
arguments**: the argument name, then input fields, with a number for a list
index. `code` is Zod's issue code (`too_small`, `too_big`, `invalid_format`,
`custom`, ...). `constraint` is the `@constraint` argument that refused
(`minLength`, `format`, `maxItems`, ...); it is absent for a refusal of a
[`validated`](#validated) schema. A refusal of one of
[your own formats](constraints.md#your-own-formats) is `format` whatever its
`code` (a `.regex()` or `.refine()` inside it included), and its `message`
is your schema's. Otherwise `message` is Zod's, in English, and is not
meant for display in every language: map on `constraint` and `path` if you
translate. Prefer `constraint` to `code`: it is the name in your schema, while
`code` is Zod's and can change when Zod does across a major version.

`value` is what that argument was declared with, exactly as written: `100` for
`maxLength: 100`, `"^[0-9]{5}$"` for a `pattern`, `"email"` for
`format: "email"`. A client can say "at most 100 characters" from
`constraint` and `value` without parsing `message`. It is present exactly when
`constraint` is, so a refusal of a [`validated`](#validated) schema has
neither.

### Types

```ts
interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly code: string;
  /** The `@constraint` argument that refused; absent for `validated`'s own schema. */
  readonly constraint?: ConstraintArgument;
  /** What that argument was declared with, as written; present exactly when `constraint` is. */
  readonly value?: string | number;
}

type ConstraintArgument =
  | 'format' | 'minLength' | 'maxLength' | 'startsWith' | 'endsWith'
  | 'contains' | 'notContains' | 'pattern' | 'min' | 'max'
  | 'exclusiveMin' | 'exclusiveMax' | 'multipleOf' | 'minItems' | 'maxItems';

type BadUserInputExtensions = {
  readonly code: 'BAD_USER_INPUT';
  readonly issues: readonly ValidationIssue[];
};
```

## In a client

Map the issues onto form fields by path. A path of `['input', 'address', 'zip']`
is the field `address.zip` of the `input` argument.

```ts
import type { BadUserInputExtensions, ValidationIssue } from '@nxgt/graphql-validation';

interface GraphQLErrorJson {
  message: string;
  extensions?: Partial<BadUserInputExtensions>;
}

/** Field errors keyed by `address.zip`, relative to the `input` argument. */
function fieldErrors(errors: readonly GraphQLErrorJson[]): Record<string, string[]> {
  const byField: Record<string, string[]> = {};
  for (const error of errors) {
    if (error.extensions?.code !== 'BAD_USER_INPUT') continue;
    for (const issue of (error.extensions.issues ?? []) as ValidationIssue[]) {
      const [, ...field] = issue.path; // drop the argument name, `input`
      const key = field.join('.');
      (byField[key] ??= []).push(issue.message);
    }
  }
  return byField;
}

// { email: ['Invalid email address'], name: ['Too small: ...'] }

/** Translated texts, keyed by the stable `constraint`, not by Zod's `code`. */
const texts: Record<string, string> = {
  format: 'Not a valid value',
  minLength: 'Too short',
  maxItems: 'Too many items',
};

const textOf = (issue: ValidationIssue) =>
  (issue.constraint && texts[issue.constraint]) ?? issue.message;
```

An issue whose path is just the argument (`['code']` for `check(code: ...)`)
gives the empty key: show it as a form-level error.

## `validated`

`validated(schema, resolver)` checks the arguments with a Zod schema you write,
for what a directive cannot say: a rule across arguments or fields, a business
refinement, an async check. It raises the same error, so a client has one shape
to handle.

```ts
import { validated } from '@nxgt/graphql-validation';
import { z } from 'zod';

const range = z
  .object({ from: z.number(), to: z.number() })
  .refine(({ from, to }) => from <= to, {
    message: 'from must not exceed to',
    path: ['to'],
  });

const resolvers = {
  Query: {
    // (source, args, context, info): args is z.output of the schema
    range: validated(range, (_, { from, to }) => to - from),
  },
};
```

A bad `{ from: 4, to: 1 }` gives `Invalid arguments for Query.range. to: from must not exceed to`
with one issue `{ path: ['to'], message: 'from must not exceed to', code: 'custom' }`.

- The schema is a Zod object schema of the arguments, or its **shape**
  (`{ name: z.string() }`, wrapped in `z.object` for you).
- The resolver receives `z.output`: defaults and transforms applied.
- Async refinements work; the check awaits them.
- When a field has both `@constraint` and `validated`, the directives run
  first, then your schema.

```ts
import { validated } from '@nxgt/graphql-validation';
import { z } from 'zod';

declare const users: { exists(name: string): Promise<boolean> };

// type Query { claim(name: String! @constraint(minLength: 3)): String }
const claim = validated(
  { name: z.string().refine(async (name) => !(await users.exists(name)), 'already taken') },
  (_, { name }) => name,
);
```

### A schema that reads the context

A check that needs the request (a uniqueness query in the request's database, a
rule that depends on the viewer) takes a function in place of the schema. It
receives the GraphQL context and the field's `info`, and returns the schema or
its shape, or a promise of either.

```ts
import { validated } from '@nxgt/graphql-validation';
import { z } from 'zod';

type Context = {
  viewer: { id: string; role: 'member' | 'admin' };
  db: {
    users: {
      exists(filter: { name: string }): Promise<boolean>;
      rename(id: string, name: string): Promise<unknown>;
    };
  };
};

// type Mutation { rename(name: String!, reason: String): User }
const rename = validated(
  (ctx: Context) => ({
    name: z
      .string()
      .min(3)
      .refine(async (name) => !(await ctx.db.users.exists({ name })), 'already taken'),
    // a rule that depends on the viewer
    reason: ctx.viewer.role === 'admin' ? z.string().min(1) : z.string().optional(),
  }),
  (_, { name }, ctx) => ctx.db.users.rename(ctx.viewer.id, name),
);
```

- The function runs **on each call**, before the arguments are parsed; a fixed
  schema is still built once, up front.
- Its result is parsed exactly like a fixed schema, with the same
  `BAD_USER_INPUT` error.
- What the function **throws** reaches the client as it is, not as
  `BAD_USER_INPUT`: throw your own error for a missing session, say.
- On a field with both `@constraint` and a `validated` function, the directives
  run first (`withValidation` wraps the field's resolver, which is the
  `validated` one); then the function is called and its schema checks the
  arguments.
- Annotate the function's `ctx` parameter: that is where the resolver's context
  type comes from, and the arguments' types come from what the function returns.

The declared signature (the third overload takes `ArgsSchemaFor<S, TContext>`,
the schema or that function, for a helper that forwards either):

```ts
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type { z } from 'zod';

type ArgsSchema = z.ZodType<Record<string, unknown>> | z.ZodRawShape;
type SchemaOf<S extends ArgsSchema> = S extends z.ZodType
  ? S
  : S extends z.ZodRawShape
    ? z.ZodObject<{ [K in keyof S]: S[K] }>
    : never;
type SchemaFactory<S extends ArgsSchema, TContext> = (context: TContext, info: GraphQLResolveInfo) => S | Promise<S>;
type ArgsSchemaFor<S extends ArgsSchema, TContext = unknown> = S | SchemaFactory<S, TContext>;

declare function validated<S extends ArgsSchema, TSource = unknown, TContext = unknown, TResult = unknown>(
  schema: SchemaFactory<S, TContext>,
  resolve: (source: TSource, args: z.output<SchemaOf<S>>, context: TContext, info: GraphQLResolveInfo) => TResult,
): GraphQLFieldResolver<TSource, TContext, z.input<SchemaOf<S>>, Promise<Awaited<TResult>>>;
declare function validated<S extends ArgsSchema, TSource = unknown, TContext = unknown, TResult = unknown>(
  schema: S,
  resolve: (source: TSource, args: z.output<SchemaOf<S>>, context: TContext, info: GraphQLResolveInfo) => TResult,
): GraphQLFieldResolver<TSource, TContext, z.input<SchemaOf<S>>, Promise<Awaited<TResult>>>;
declare function validated<S extends ArgsSchema, TSource = unknown, TContext = unknown, TResult = unknown>(
  schema: ArgsSchemaFor<S, TContext>,
  resolve: (source: TSource, args: z.output<SchemaOf<S>>, context: TContext, info: GraphQLResolveInfo) => TResult,
): GraphQLFieldResolver<TSource, TContext, z.input<SchemaOf<S>>, Promise<Awaited<TResult>>>;
```

`validated` validates whatever the field's arguments are; it does not need
`withValidation` or `constraintTypeDefs` to work.

## `badUserInput`

For code that validates by hand and wants the same error:

```ts
import { badUserInput } from '@nxgt/graphql-validation';
import { z } from 'zod';

const result = z.object({ code: z.string().length(4) }).safeParse({ code: 'abc' });
if (!result.success) throw badUserInput('Query.redeem', result.error);
// message: "Invalid arguments for Query.redeem. code: Too small: expected string to have exactly 4 characters"
```

```ts
import type { GraphQLError } from 'graphql';
import type { z } from 'zod';

declare function badUserInput(where: string, error: z.ZodError): GraphQLError;
```
