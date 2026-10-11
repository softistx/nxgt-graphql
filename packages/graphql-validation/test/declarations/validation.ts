// An application's resolvers and schema, behind exported values whose types
// are inferred: a declaration build must be able to name each one through
// `@nxgt/graphql-validation` and its peers alone (TS2883 otherwise).
import {
	badUserInput,
	constraintTypeDefs,
	validated,
	withValidation,
} from '@nxgt/graphql-validation';
import {
	checkConstraints,
	constraintsOn,
	inputCode,
} from '@nxgt/graphql-validation/codegen';
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

// An application's formats module, named to withValidation.
export const formatSchemas = { siret: z.string().regex(/^\d{14}$/) };
export const withFormats = withValidation(
	buildSchema(
		`${constraintTypeDefs}\ntype Query { a(s: String @constraint(format: "siret")): Int }`,
	),
	{ formats: formatSchemas },
);

export const refused = badUserInput('Query.a', new z.ZodError([]));

// The ./codegen subpath, as a code generator holds its results.
const codegenSchema = buildSchema(
	`${constraintTypeDefs} type Query { a(n: Int @constraint(min: 1)): Int }`,
);
export const directive = checkConstraints(codegenSchema);
export const directiveWithFormats = checkConstraints(
	codegenSchema,
	undefined,
	formatSchemas,
);
const arg = codegenSchema.getQueryType()?.getFields()['a']?.args[0];
export const constraints = constraintsOn(directive, arg?.astNode);
export const source = arg
	? inputCode(arg.type, constraints, 'Query.a(n:)', (type) => type.name)
	: '';
export const sourceWithFormats = arg
	? inputCode(
			arg.type,
			constraints,
			'Query.a(n:)',
			(type) => type.name,
			{},
			formatSchemas,
		)
	: '';
