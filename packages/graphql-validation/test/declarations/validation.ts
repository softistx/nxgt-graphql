// An application's resolvers and schema, behind exported values whose types
// are inferred: a declaration build must be able to name each one through
// `@nxgt/graphql-validation` and its peers alone (TS2883 otherwise).
import {
	badUserInput,
	constraintTypeDefs,
	validated,
	withValidation,
} from '@nxgt/graphql-validation';
import { buildSchema } from 'graphql';
import { z } from 'zod';

export const signUp = validated(
	{ email: z.email(), age: z.int().min(18) },
	(_source, { email, age }) => ({ email, age }),
);

export const range = validated(
	z
		.object({ from: z.number(), to: z.number() })
		.refine(({ from, to }) => from <= to),
	async (_source, { from, to }) => to - from,
);

export const schema = withValidation(
	buildSchema(
		`${constraintTypeDefs}\ntype Query { a(n: Int @constraint(min: 0)): Int }`,
	),
);

export const refused = badUserInput('Query.a', new z.ZodError([]));
