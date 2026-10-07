import { describe, expect, test } from 'bun:test';
import { buildSchema, type GraphQLObjectType, graphql } from 'graphql';
import { z } from 'zod';
import { constraintTypeDefs } from './constraint-directive';
import { validated } from './validated';
import { withValidation } from './with-validation';

function schemaWith(
	resolve: unknown,
	sdl = 'type Query { range(from: Int!, to: Int!): Int }',
) {
	const schema = buildSchema(`${constraintTypeDefs}\n${sdl}`);
	const [field] = Object.values(
		(schema.getQueryType() as GraphQLObjectType).getFields(),
	);
	(field as { resolve?: unknown }).resolve = resolve;
	return schema;
}

const range = z
	.object({ from: z.number(), to: z.number() })
	.refine(({ from, to }) => from <= to, {
		message: 'from must not exceed to',
		path: ['to'],
	});

describe('validated', () => {
	test('runs the resolver with the parsed arguments', async () => {
		const schema = schemaWith(validated(range, (_, { from, to }) => to - from));
		expect(
			await graphql({ schema, source: '{ range(from: 1, to: 4) }' }),
		).toEqual({
			data: { range: 3 },
		});
	});

	test('refuses with the same BAD_USER_INPUT error as the directives', async () => {
		const schema = schemaWith(validated(range, () => 0));
		const result = await graphql({
			schema,
			source: '{ range(from: 4, to: 1) }',
		});
		expect(result.errors?.[0]?.message).toBe(
			'Invalid arguments for Query.range. to: from must not exceed to',
		);
		expect(result.errors?.[0]?.extensions).toEqual({
			code: 'BAD_USER_INPUT',
			issues: [
				{ path: ['to'], message: 'from must not exceed to', code: 'custom' },
			],
		});
	});

	test('takes a shape and hands the resolver z.output, transforms applied', async () => {
		const schema = schemaWith(
			validated(
				{ name: z.string().trim().toUpperCase() },
				(_, { name }) => name,
			),
			'type Query { shout(name: String!): String }',
		);
		expect(
			await graphql({ schema, source: '{ shout(name: "  ada ") }' }),
		).toEqual({
			data: { shout: 'ADA' },
		});
	});

	test('runs an async refinement', async () => {
		const taken = z.object({
			name: z.string().refine(async (name) => name !== 'root', 'already taken'),
		});
		const schema = schemaWith(
			validated(taken, (_, { name }) => name),
			'type Query { claim(name: String!): String }',
		);
		const result = await graphql({ schema, source: '{ claim(name: "root") }' });
		expect(result.errors?.[0]?.extensions['code']).toBe('BAD_USER_INPUT');
	});

	test('runs after the directives when both apply', async () => {
		const schema = withValidation(
			schemaWith(
				validated(
					{ name: z.string().transform((name) => name.length) },
					(_, { name }) => name,
				),
				'type Query { size(name: String! @constraint(maxLength: 3)): Int }',
			),
		);
		expect(await graphql({ schema, source: '{ size(name: "abc") }' })).toEqual({
			data: { size: 3 },
		});
		const refused = await graphql({ schema, source: '{ size(name: "abcd") }' });
		expect(refused.errors?.[0]?.message).toStartWith(
			'Invalid arguments for Query.size. name: ',
		);
	});
});
