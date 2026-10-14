// An application's resolvers and schema, behind exported values whose types
// are inferred: a declaration build must be able to name each one through
// `@nxgt/graphql-validation` and its peers alone (TS2883 otherwise).
import {
	type ArgsSchema,
	type ArgsSchemaFor,
	badUserInput,
	constraintTypeDefs,
	FIELD_CODES,
	type FormatSchemas,
	fieldIssueOf,
	fieldsError,
	inputPath,
	invalidInputError,
	type Translate,
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

// A shape types its arguments (they were `unknown`).
export const typedShape = validated({ a: z.string() }, (_source, { a }) => {
	const text: string = a;
	// @ts-expect-error -- `a` is a string, not a number
	const wrong: number = a;
	return [text, wrong];
});

// A function in place of the schema: the arguments come from what it returns,
// the context from its annotated parameter.
type Context = { db: { exists(name: string): Promise<boolean> } };
export const rename = validated(
	(ctx: Context) => ({
		name: z.string().refine(async (name) => !(await ctx.db.exists(name))),
	}),
	(_source, { name }, ctx) => {
		const text: string = name;
		// @ts-expect-error -- `name` is a string, not a number
		const wrong: number = name;
		const db: Context['db'] = ctx.db;
		return [text, wrong, db];
	},
);
export const renameAsync = validated(
	async (_ctx: Context) => z.object({ age: z.coerce.number() }),
	(_source, { age }) => {
		const n: number = age;
		return n;
	},
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

// A record typed wider than its literal may hold no built-in name: it passes.
const widened: FormatSchemas = formatSchemas;
const loose: Record<string, z.ZodString> = { siret: z.string() };
export const withWidened = withValidation(withFormats, { formats: widened });
export const withLoose = withValidation(
	buildSchema(`${constraintTypeDefs}\ntype Query { a: Int }`),
	{ formats: loose },
);

// A literal record naming a built-in format is a type error.
export const withBuiltInName = () =>
	withValidation(buildSchema(`${constraintTypeDefs}\ntype Query { a: Int }`), {
		// @ts-expect-error -- "email" is a built-in format
		formats: { email: z.email() },
	});

export const factory: ArgsSchemaFor<
	z.ZodObject<{ a: z.ZodString }>,
	Context
> = () => z.object({ a: z.string() });

// A generic helper forwarding an `ArgsSchemaFor` (the schema or the function).
export function helper<S extends ArgsSchema>(s: ArgsSchemaFor<S, Context>) {
	return validated(s, (_source, args) => args);
}
export const helped = helper(factory);

// A function returning a non-object schema is refused.
const notAnObject = () => z.string();
// @ts-expect-error -- not an object schema
validated(notAnObject, (_source, args) => args);

export const refused = badUserInput('Query.a', new z.ZodError([]));

// An API that answers invalid input as one 400 error with a list of fields.
const translate: Translate = (code) => code;
export const invalid = invalidInputError(
	[
		{
			path: inputPath(['input', 'name']),
			code: 'too-short',
			params: { min: 2 },
		},
	],
	{ translate, path: ['signUp'] },
);
export const conflict = fieldsError(
	'conflict',
	[{ path: 'email', code: 'taken' }],
	{
		status: 409,
		params: { name: 'Ada' },
	},
);
export const translated = { translate };

// A Zod parse answered as that error, with the codes for translations.
const parsed = z.object({ name: z.string().min(2) }).safeParse({ name: 'a' });
export const fromZod = invalidInputError(
	parsed.success ? [] : parsed.error.issues.map(fieldIssueOf),
	{ translate },
);
export const mapIssue = fieldIssueOf;
export const codes = FIELD_CODES;
export const symbolPath = inputPath(['input', Symbol('k'), 0]);

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
