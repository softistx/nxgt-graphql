---
"@nxgt/graphql-validation": minor
---

`validated` accepts a function in place of the schema (or shape), `(context, info) => schema | shape` (or a promise of either), for checks that need the request: a uniqueness query in the request's database, a rule that depends on the viewer. It is called on each call; its result is parsed like a fixed schema, with the same `BAD_USER_INPUT` error, and what it throws reaches the client as it is. New type `ArgsSchemaFor`.

Fix: the arguments of a resolver given a shape (`validated({ a: z.string() }, (_, { a }) => …)`) were typed `unknown`; they now have the shape's types.
