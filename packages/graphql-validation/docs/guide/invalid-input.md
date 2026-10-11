# Answering invalid input as one error

Some APIs answer invalid input as **one 400 error with a list of fields**,
each with a code a client translates or a message already translated, rather
than as [`BAD_USER_INPUT`](errors.md) with Zod's issues. `invalidInputError`
and `fieldsError` build that error, so every resolver and every module words
it the same way. They do not change what `withValidation` and `validated`
raise: those still throw `BAD_USER_INPUT`.

## The error

```ts
import { invalidInputError } from '@nxgt/graphql-validation';

throw invalidInputError(
  [
    { path: 'person.lastName', code: 'validation.errors.required' },
    { path: 'person.firstName', code: 'validation.errors.too-short', params: { min: 2 } },
  ],
  { translate: (code, params) => t(code, params) }, // your i18n function
);
```

```json
{
  "errors": [
    {
      "message": "Invalid input",
      "path": ["createPerson"],
      "extensions": {
        "code": "validation.errors.invalid-input",
        "http": { "status": 400 },
        "fields": [
          { "path": "person.lastName", "code": "validation.errors.required", "message": "Required" },
          { "path": "person.firstName", "code": "validation.errors.too-short", "message": "At least 2 characters", "params": { "min": 2 } }
        ]
      }
    }
  ],
  "data": { "createPerson": null }
}
```

- `message` is `translate('validation.errors.invalid-input')`, or that code
  itself without `translate` (also exported as `INVALID_INPUT`).
- `extensions.code` is `validation.errors.invalid-input`, and
  `extensions.http.status` is `400`, for a server that sets the response's
  HTTP status from it (GraphQL Yoga and Apollo Server read this key).
- `extensions.fields` holds one entry per issue, **in the order given**
  (duplicates kept): `path` and `code` as you wrote them, `message` as
  `translate(code, params)` or the code itself, and `params` only when the
  issue has some.
- **`params` is never `{}`**: an issue whose `params` has no key is written
  without it, and `translate` receives `undefined` for it.
- A `translate` that returns `undefined` at run time (a missing key in some
  i18n libraries) falls back to the code, as if there were none.

## GraphQL's options

The second argument also takes `GraphQLError`'s own options, so the error
keeps its cause and its place in the response:

```ts
throw invalidInputError(issues, {
  translate,
  originalError: zodError, // kept: error.originalError
  path: info.path ? [info.path.key] : undefined,
});
```

**`extensions` among them is replaced**, not merged: the error's
`extensions` is always exactly the shape above. Put anything else your
server needs in a `formatError` hook.

## From a resolver

A check that needs the database, or a rule your schema cannot say, ends with
the same error:

```ts
import { type FieldIssue, invalidInputError } from '@nxgt/graphql-validation';

const resolvers = {
  Mutation: {
    async createPerson(_: unknown, { input }: { input: PersonInput }, { t }: Context) {
      const issues: FieldIssue[] = [];
      if (!input.person.lastName.trim())
        issues.push({ path: 'person.lastName', code: 'validation.errors.required' });
      if (input.person.birthDate > new Date())
        issues.push({ path: 'person.birthDate', code: 'validation.errors.in-the-future' });
      if (issues.length) throw invalidInputError(issues, { translate: t });
      return people.create(input.person);
    },
  },
};
```

## From a zod parse

Map each Zod issue to a `FieldIssue`. `inputPath` turns a GraphQL path into
a dotted one, dropping the leading `input` argument:

```ts
import { type FieldIssue, inputPath, invalidInputError } from '@nxgt/graphql-validation';
import { z } from 'zod';

const PersonInput = z.object({
  person: z.object({
    firstName: z.string().min(2),
    email: z.email(),
  }),
});

function issuesOf(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => {
    const path = inputPath(['input', ...issue.path.map((key) => (typeof key === 'number' ? key : String(key)))]);
    if (issue.code === 'too_small' && issue.origin === 'string')
      return { path, code: 'validation.errors.too-short', params: { min: Number(issue.minimum) } };
    return { path, code: `validation.errors.${issue.code}` };
  });
}

const result = PersonInput.safeParse(input);
if (!result.success)
  throw invalidInputError(issuesOf(result.error), { translate: t, originalError: result.error });
```

`inputPath(['input', 'person', 'firstName'])` is `person.firstName`,
`['input', 'tags', 1]` is `tags.1`; a path that does not start with `input`
(`['first']`), or is `['input']` alone, is only joined with dots.

The same mapping reads [`BAD_USER_INPUT`](errors.md)'s `issues[].path`, which
starts with the argument name.

## A refusal that names fields: `fieldsError`

For a refusal of your own that is not a 400, a 409 conflict for instance,
that still points at the fields at fault:

```ts
import { fieldsError } from '@nxgt/graphql-validation';

throw fieldsError(
  'person.errors.duplicate',
  [{ path: 'person.email', code: 'person.errors.email-taken' }],
  { translate: t, status: 409, params: { name: existing.name } },
);
```

```json
{
  "message": "Already registered as Ada",
  "extensions": {
    "code": "person.errors.duplicate",
    "params": { "name": "Ada" },
    "http": { "status": 409 },
    "fields": [
      { "path": "person.email", "code": "person.errors.email-taken", "message": "This email is taken" }
    ]
  }
}
```

- `message` is `translate(code, params)`, or `code`.
- `extensions` is `{ code, params?, http?, fields }`, in that order:
  `params` only when it has a key, `http: { status }` only when `status` is
  given, `fields` worded as `invalidInputError` words them.
- GraphQL's options are kept and an `extensions` among them is replaced, as
  above.

## Types

```ts
import type { GraphQLError, GraphQLErrorOptions } from 'graphql';

type IssueParams = Record<string, string | number>;

interface FieldIssue {
  readonly path: string;
  readonly code: string;
  readonly params?: IssueParams; // {} counts as none
}

/** One entry of `extensions.fields`. */
interface FieldError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
  readonly params?: IssueParams;
}

type Translate = (code: string, params?: IssueParams) => string;

type InvalidInputOptions = GraphQLErrorOptions & { readonly translate?: Translate };
type FieldsErrorOptions = InvalidInputOptions & {
  readonly status?: number;
  readonly params?: IssueParams;
};

declare const INVALID_INPUT: 'validation.errors.invalid-input';
declare function invalidInputError(issues: readonly FieldIssue[], options?: InvalidInputOptions): GraphQLError;
declare function fieldsError(code: string, issues: readonly FieldIssue[], options?: FieldsErrorOptions): GraphQLError;
declare function inputPath(path: readonly (string | number)[]): string;
```
