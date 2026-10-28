import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { buildSchema, parse } from 'graphql';
import type { CodegenZodConfig } from './config';
import { plugin } from './index';
import { variablesSchemaName } from './variables-name';

const sdl = `
type Query { getHTTPThing(id: ID!): ID  get_book(id: ID!): ID   getTHINGQUERY(id: ID!): ID }
type Mutation { createUser(id: ID!): ID }
type Subscription { onTick(id: ID!): ID }
`;
const operations = [
	[
		'getHTTPThing',
		'query',
		'query getHTTPThing($id: ID!) { getHTTPThing(id: $id) }',
	],
	['get_book', 'query', 'query get_book($id: ID!) { get_book(id: $id) }'],
	[
		'getTHINGQUERY',
		'query',
		'query getTHINGQUERY($id: ID!) { getTHINGQUERY(id: $id) }',
	],
	[
		'createUser',
		'mutation',
		'mutation createUser($id: ID!) { createUser(id: $id) }',
	],
	[
		'onTick',
		'subscription',
		'subscription onTick($id: ID!) { onTick(id: $id) }',
	],
] as const;

/** The names of the variables schemas the plugin really writes. */
async function emitted(config: CodegenZodConfig): Promise<string[]> {
	const output = await plugin(
		buildSchema(sdl),
		operations.map(([, , source]) => ({ document: parse(source) })),
		{ operations: false, objects: false, ...config },
	);
	return [...output.matchAll(/export const (\w+) = z\.object/g)]
		.map((match) => match[1] as string)
		.filter((name) => /variables/i.test(name));
}

function computed(config: CodegenZodConfig): string[] {
	return operations.map(([name, kind]) =>
		variablesSchemaName(config, name, kind),
	);
}

const configs: [string, CodegenZodConfig][] = [
	['default', {}],
	['dedupe', { dedupeOperationSuffix: true }],
	['omit', { omitOperationSuffix: true }],
	[
		'prefix and suffix',
		{ typesPrefix: 'I', typesSuffix: 'T', schemaPrefix: 'zz' },
	],
	[
		'prefix, suffix and a case',
		{
			typesPrefix: 'I',
			typesSuffix: 'T',
			namingConvention: 'change-case-all#snakeCase',
			dedupeOperationSuffix: true,
		},
	],
	['keep', { namingConvention: 'keep' }],
	['keep, dedupe', { namingConvention: 'keep', dedupeOperationSuffix: true }],
	['change-case-all string', { namingConvention: 'change-case-all#upperCase' }],
	['function', { namingConvention: (name) => name.toUpperCase() }],
	['object keep', { namingConvention: { typeNames: 'keep' } }],
	[
		'object case',
		{ namingConvention: { typeNames: 'change-case-all#snakeCase' } },
	],
	['object underscore', { namingConvention: { transformUnderscore: true } }],
];

describe('variablesSchemaName', () => {
	test('names the issue reports', () => {
		expect(variablesSchemaName({}, 'getHTTPThing', 'query')).toBe(
			'zGetHttpThingQueryVariables',
		);
		expect(variablesSchemaName({}, 'get_book', 'query')).toBe(
			'zGet_BookQueryVariables',
		);
		expect(
			variablesSchemaName(
				{ dedupeOperationSuffix: true },
				'getThingQuery',
				'query',
			),
		).toBe('zGetThingQueryVariables');
		expect(
			variablesSchemaName(
				{ dedupeOperationSuffix: true },
				'getTHINGQUERY',
				'query',
			),
		).toBe('zGetThingqueryVariables');
		expect(
			variablesSchemaName(
				{ omitOperationSuffix: true },
				'createUser',
				'mutation',
			),
		).toBe('zCreateUserVariables');
		expect(
			variablesSchemaName({ namingConvention: 'keep' }, 'get_book', 'query'),
		).toBe('zget_bookQueryVariables');
	});

	test.each(configs)('equals the plugin output: %s', async (_, config) => {
		expect(await emitted(config)).toEqual(computed(config));
	});
});

describe('the ./naming subpath', () => {
	const dist = new URL('../dist/', import.meta.url);

	test.skipIf(!existsSync(new URL('variables-name.js', dist)))(
		'exports exactly the documented names',
		async () => {
			const entry = await import(new URL('variables-name.js', dist).href);
			expect(Object.keys(entry)).toEqual(['variablesSchemaName']);
			const declarations = await Bun.file(
				new URL('variables-name.d.ts', dist),
			).text();
			expect(declarations).toContain('variablesSchemaName');
			expect(declarations).not.toContain('class Naming');
		},
	);

	test.skipIf(!existsSync(new URL('variables-name.js', dist)))(
		'imports only its chunk and change-case',
		async () => {
			const source = await Bun.file(new URL('variables-name.js', dist)).text();
			const chunk = source.match(/from "(\.\/chunks\/[^"]+)"/)?.[1] ?? '';
			const specifiers = (text: string) =>
				[...text.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
			expect(specifiers(source)).toEqual([chunk]);
			const chunkSource = await Bun.file(new URL(chunk, dist)).text();
			expect(specifiers(chunkSource)).toEqual(['change-case']);
		},
	);
});
