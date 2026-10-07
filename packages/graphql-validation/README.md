# @nxgt/graphql-validation

Validate GraphQL arguments and input fields with `@constraint` directives,
each checked by a Zod schema, for `graphql` 16 and 17. Work in progress: the
API below grows slice by slice and is not published yet.

## Install

```sh
bun add @nxgt/graphql-validation graphql zod typescript
```

## `@constraint`

Add `constraintTypeDefs` to your schema-first `typeDefs`, then constrain an
argument or an input field:

```ts
import { constraintTypeDefs } from '@nxgt/graphql-validation';

const typeDefs = [
	constraintTypeDefs,
	/* GraphQL */ `
		input SignUp {
			email: String! @constraint(format: "email", maxLength: 254)
			age: Int @constraint(min: 18)
		}
	`,
];
```

The arguments are graphql-constraint-directive's.
