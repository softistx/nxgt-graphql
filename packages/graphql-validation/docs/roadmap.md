# Roadmap

What `@nxgt/graphql-validation` is heading for, phrased as what you get.

## Now

Nothing in progress.

## Next

- **Schemas that read the context**, `(args, context) => schema`, for checks
  that need the request (uniqueness in a database, permissions).

## Later

- **Emit the invalid-input shape directly.** An option for `withValidation`
  and `validated` to raise the `invalidInputError` shape in place of
  `BAD_USER_INPUT`, so an API using it needs no mapping of its own.

## Shipped

- **Answering invalid input as one error** — 0.4.0.
  `invalidInputError(issues, { translate })` builds one 400 error whose
  `extensions.fields` lists every field at fault with your own codes,
  translated; `fieldsError` does the same for a refusal such as a 409
  conflict; `fieldIssueOf` maps a Zod issue to a field and a code
  (`too-short`, `invalid-format`, …), the mapping
  [`@nxgt/graphql-codegen-msw`](https://www.npmjs.com/package/@nxgt/graphql-codegen-msw)'s
  mocks apply; `inputPath` turns a GraphQL or Zod path into `person.firstName`.
- **Your own formats** — 0.3.0. Name a Zod string schema in
  `@constraint(format: "...")`: `withValidation(schema, { formats })`, one
  record your module exports, checked at startup, its refusals named
  `format`. `@nxgt/graphql-codegen-zod` 0.3 reads the same record, so the
  client refuses what the server refuses, with the same messages. From
  0.3.1 they run through Zod's public API only.
- **Declarations resolve under `nodenext`** — 0.2.1. `moduleResolution`
  `nodenext` and `node16` find every export, as `bundler` does.
- **A Zod codegen plugin** — 0.2.0. [`@nxgt/graphql-codegen-zod`](https://www.npmjs.com/package/@nxgt/graphql-codegen-zod)
  writes the same schemas as source, from the same rules, so the types your
  resolvers receive and the variables a client sends come from your SDL. This
  package gains `@nxgt/graphql-validation/codegen` for it.
- **`@constraint` on arguments and input fields** — 0.1.0.
  `constraintTypeDefs` for your SDL, then `withValidation(schema)`: every
  constrained argument is checked by a Zod schema built from its directives,
  through nested input types and lists, before your resolver runs. The
  resolver receives the parsed value.
- **One error a form can use** — 0.1.0. An invalid input is one
  `GraphQLError` with `extensions.code` `BAD_USER_INPUT` and an `issues`
  list, each with the path of the offending field inside the arguments.
- **`validated(schema, resolver)`** — 0.1.0. For what a directive cannot
  say: rules across fields, business refinements, with the same error.
- **Formats** — 0.1.0. `byte`, `date-time`, `date`, `email`, `ipv4`, `ipv6`,
  `uri`, `uuid`.
