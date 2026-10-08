# Roadmap

What `@nxgt/graphql-validation` is heading for, phrased as what you get.

## Now

- **`@constraint` on arguments and input fields.** `constraintTypeDefs` for
  your SDL, then `withValidation(schema)`: every constrained argument is
  checked by a Zod schema built from its directives, through nested input
  types and lists, before your resolver runs. The resolver receives the
  parsed value.
- **One error a form can use.** An invalid input is one `GraphQLError` with
  `extensions.code` `BAD_USER_INPUT` and an `issues` list, each with the
  path of the offending field inside the arguments.
- **`validated(schema, resolver)`** for what a directive cannot say: rules
  across fields, business refinements, with the same error.
- **Formats** `byte`, `date-time`, `date`, `email`, `ipv4`, `ipv6`, `uri`,
  `uuid`.

## Next

- **Your own formats**, named in `@constraint(format: "...")`.
- **Schemas that read the context**, `(args, context) => schema`, for checks
  that need the request (uniqueness in a database, permissions).

## Shipped

- **A Zod codegen plugin**, [`@nxgt/graphql-codegen-zod`](https://www.npmjs.com/package/@nxgt/graphql-codegen-zod):
  it writes the same schemas as source, from the same rules, so the types your
  resolvers receive and the variables a client sends come from your SDL. This
  package gains `@nxgt/graphql-validation/codegen` for it.
