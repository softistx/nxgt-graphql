// A codegen setup and a mock module holding the plugin, its options and the
// runtime's builders behind exported values whose types are inferred: a
// declaration build must name each one through `@nxgt/graphql-codegen-msw`,
// its `./runtime` subpath and their peers alone (TS2883 otherwise).
import { type CodegenMswConfig, plugin } from '@nxgt/graphql-codegen-msw';
import {
	badUserInputRefusal,
	errorResponse,
	fieldIssueOf,
	type InvalidInput,
	invalidInputRefusal,
	mockOperation,
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
		endpoint: '*/graphql',
		invalidInput: refusals.default,
	},
	({ variables }) => HttpResponse.json({ data: { a: variables.n ?? null } }),
	{ once: true },
);

export const refused = errorResponse({ message: 'no' }, { status: 409 });
