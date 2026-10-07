import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	GraphQLObjectType,
	type GraphQLScalarType,
	GraphQLSchema,
	graphql,
} from 'graphql';
import {
	DateTimeScalar,
	PositiveIntScalar,
	scalarResolvers,
	scalarTypeDefs,
	URLScalar,
} from './index';

describe('scalarTypeDefs and scalarResolvers', () => {
	test('declare the same scalars, with their specifiedBy URLs', () => {
		const schema = buildSchema(`${scalarTypeDefs}\ntype Query { ok: Boolean }`);
		for (const [name, scalar] of Object.entries(scalarResolvers)) {
			const declared = schema.getType(name) as GraphQLScalarType;
			expect(declared.name).toBe(scalar.name);
			expect(declared.specifiedByURL ?? undefined).toBe(
				scalar.specifiedByURL ?? undefined,
			);
		}
		expect(scalarTypeDefs.split('\n')).toHaveLength(
			Object.keys(scalarResolvers).length,
		);
	});
});

describe('in an executed schema', () => {
	const schema = new GraphQLSchema({
		query: new GraphQLObjectType({
			name: 'Query',
			fields: {
				later: {
					type: DateTimeScalar,
					args: {
						at: { type: DateTimeScalar },
						days: { type: PositiveIntScalar },
					},
					resolve: (_, args: { at: Date; days: number }) =>
						new Date(args.at.getTime() + args.days * 86_400_000),
				},
				broken: { type: URLScalar, resolve: () => 'javascript:alert(1)' },
			},
		}),
	});

	test('decodes literals and variables, and encodes the result', async () => {
		const literal = await graphql({
			schema,
			source: '{ later(at: "2024-01-01T00:00:00Z", days: 2) }',
		});
		expect(literal).toEqual({ data: { later: '2024-01-03T00:00:00.000Z' } });

		const variables = await graphql({
			schema,
			source:
				'query ($at: DateTime, $days: PositiveInt) { later(at: $at, days: $days) }',
			variableValues: { at: '2024-01-01T01:00:00+01:00', days: 1 },
		});
		expect(variables).toEqual({ data: { later: '2024-01-02T00:00:00.000Z' } });
	});

	test('a refused input is a request error', async () => {
		const result = await graphql({
			schema,
			source:
				'query ($days: PositiveInt) { later(at: "2024-01-01T00:00:00Z", days: $days) }',
			variableValues: { days: -3 },
		});
		expect(result.data).toBeUndefined();
		expect(result.errors?.[0]?.message).toContain(
			'PositiveInt cannot represent this input',
		);

		const literal = await graphql({
			schema,
			source: '{ later(at: "yesterday", days: 1) }',
		});
		expect(literal.errors?.[0]?.message).toContain(
			'DateTime cannot represent this input',
		);
		expect(literal.errors?.[0]?.locations).toEqual([{ line: 1, column: 13 }]);
	});

	test('a refused result is a field error that does not name the value', async () => {
		const result = await graphql({ schema, source: '{ broken }' });
		expect(result.data).toEqual({ broken: null });
		expect(result.errors?.[0]?.message).toContain(
			'URL cannot serialize this value',
		);
		expect(JSON.stringify(result.errors)).not.toContain('javascript:');
	});
});
