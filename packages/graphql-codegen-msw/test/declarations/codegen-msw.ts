// A codegen setup and a mock module holding the plugin, its options and the
// runtime's builders behind exported values whose types are inferred: a
// declaration build must name each one through `@nxgt/graphql-codegen-msw`,
// its `./runtime` subpath and their peers alone (TS2883 otherwise).
import { type CodegenMswConfig, plugin } from '@nxgt/graphql-codegen-msw';
import {
	badUserInputRefusal,
	errorResponse,
	type FieldError,
	type FieldIssue,
	fieldIssueOf,
	fieldsError,
	type InvalidInput,
	inputPath,
	invalidInputError,
	invalidInputRefusal,
	mockOperation,
	type Translate,
} from '@nxgt/graphql-codegen-msw/runtime';
import { buildSchema } from 'graphql';
import { HttpResponse } from 'msw';
import { z } from 'zod';

export const config = {
	endpoint: '*/graphql',
	schemasImport: './zod',
	typesImport: './graphql',
	invalidInput: 'bad-user-input',
} satisfies CodegenMswConfig;

export const output = plugin(
	buildSchema('type Query { a(n: Int): Int }'),
	[],
	config,
);
export const msw = { plugin };

export const refusals = {
	default: invalidInputRefusal({ translate: (code) => code }),
	badUserInput: badUserInputRefusal,
	own: ((issues) => ({
		error: { message: `${issues.length} invalid` },
		status: 422,
	})) satisfies InvalidInput,
	fieldIssueOf,
};

export const handler = mockOperation<
	{ a: number | null },
	{ n?: number | null }
>(
	{
		type: 'query',
		name: 'A',
		variables: z.object({ n: z.int().nullish() }),
		variableTypes: { n: 'Int' },
		inputTypes: { Int: { kind: 'builtin' } },
		endpoint: '*/graphql',
		invalidInput: refusals.default,
	},
	({ variables }) => HttpResponse.json({ data: { a: variables.n ?? null } }),
	{ once: true },
);

/** Written by hand: no types, so every refusal goes to invalidInput. */
export const handWritten = mockOperation<
	{ ping: string },
	{ times?: number | null }
>(
	{
		type: 'query',
		name: 'Ping',
		variables: z.object({ times: z.int().nullish() }),
		endpoint: '*/graphql',
		invalidInput: refusals.badUserInput,
	},
	() => HttpResponse.json({ data: { ping: 'pong' } }),
);

export const refused = errorResponse({ message: 'no' }, { status: 409 });

// An invalidInput of your own, built from ./runtime's re-exports alone.
const translate: Translate = (code) => code;
export const ownShape = ((issues) => ({
	error: invalidInputError(
		issues.map((issue): FieldIssue => {
			const field = fieldIssueOf(issue);
			return issue.code === 'too_small'
				? { ...field, params: { min: Number(issue.minimum) } }
				: field;
		}),
		{ translate },
	),
	status: 400,
})) satisfies InvalidInput;
export const conflict = fieldsError(
	'conflict',
	[{ path: inputPath(['input', Symbol('k')]), code: 'taken' }],
	{ status: 409, translate },
);
export const written: FieldError = {
	path: 'email',
	code: 'taken',
	message: 'taken',
};
