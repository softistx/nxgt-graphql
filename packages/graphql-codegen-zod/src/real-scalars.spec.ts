import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { scalarResolvers } from '@nxgt/graphql-scalars';
import { buildSchema, type GraphQLScalarType, graphql } from 'graphql';
import * as generated from '../test/generated-scalars';
import { fieldOf, generatedScalars, sdl } from '../test/real-scalars';

const GENERATED = new URL('../test/generated-scalars.ts', import.meta.url);

/** What the resolver last received. */
let received: unknown;

/** The schema served with @nxgt/graphql-scalars' resolvers, as an app does. */
function server() {
	const schema = buildSchema(sdl);
	for (const [name, resolver] of Object.entries(scalarResolvers)) {
		// graphql 17 reads coerceInputValue, graphql 16 parseValue.
		const type = schema.getType(name) as GraphQLScalarType & {
			coerceInputValue?: unknown;
		};
		Object.assign(type, {
			parseValue: resolver.parseValue,
			parseLiteral: resolver.parseLiteral,
			coerceInputValue:
				(resolver as { coerceInputValue?: unknown }).coerceInputValue ??
				resolver.parseValue,
		});
	}
	const field = schema.getQueryType()?.getFields()['all'];
	if (field)
		field.resolve = (_source, args) => {
			received = args['input'];
			return true;
		};
	return schema;
}

describe('the generated file, against the real scalarSchemas record', () => {
	test('is what the plugin writes: `bun run generated:write` if not', async () => {
		expect(await readFile(GENERATED, 'utf8')).toBe(await generatedScalars());
	});

	test('maps every scalar, alone and in a list', async () => {
		const source = await readFile(GENERATED, 'utf8');
		for (const name of Object.keys(scalarResolvers)) {
			expect(source).toContain(`${fieldOf(name)}: scalarSchemas.${name}.`);
			expect(source).toContain(`typeof scalarSchemas.${name}>>`);
		}
	});

	test('takes and refuses what the server does, and decodes as it does', async () => {
		const served = server();
		const variables = generated.zAllQueryVariables;
		for (const input of [
			{ dateTime: '2020-01-01T00:00:00Z' },
			{ dateTime: 'nope' },
			{ dateTimeList: '2020-01-01T00:00:00Z' },
			{ dateTimeList: ['2020-01-01T00:00:00Z', 'nope'] },
			{ long: '9007199254740993' },
			{ longList: '9007199254740993' },
			{ bigInt: '123456789012345678901234567890' },
			{ uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
			{ uuid: 'nope' },
			{ uuidList: null },
			{ json: { a: [1, 'b'] } },
			{ jsonList: [{ a: 1 }] },
			{ emailAddress: 'a@b.co' },
			{ emailAddress: 'a@b' },
			{ positiveInt: 0 },
			{ positiveIntList: 3 },
			{ timestamp: 0 },
		]) {
			received = undefined;
			const result = await graphql({
				schema: served,
				source: 'query All($input: AllScalars!) { all(input: $input) }',
				variableValues: { input },
			});
			const client = variables.safeParse({ input });
			expect([input, client.success]).toEqual([
				input,
				result.errors === undefined,
			]);
			if (client.success)
				expect(client.data.input as unknown).toEqual(received);
		}
	});
});
