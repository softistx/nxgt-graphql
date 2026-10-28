import { describe, expect, test } from 'bun:test';
import { buildSchema, parse } from 'graphql';
import type { CodegenZodConfig } from './config';
import { plugin } from './index';
import { variablesSchemaName } from './naming';

const sdl = `
type Query { getHTTPThing(id: ID!): ID  get_book(id: ID!): ID  getThingQuery(id: ID!): ID }
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
		'getThingQuery',
		'query',
		'query getThingQuery($id: ID!) { getThingQuery(id: $id) }',
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
