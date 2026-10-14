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

	describe('given a function in place of the schema', () => {
		const claimSdl = 'type Query { claim(name: String!): String }';
		const run = (
			schema: ReturnType<typeof schemaWith>,
			contextValue?: unknown,
		) => graphql({ schema, source: '{ claim(name: "ada") }', contextValue });

		test('hands it the context and the field info, and the resolver the parsed arguments', async () => {
			const seen: { context?: unknown; field?: string } = {};
			const context = { tag: 'request' };
			const schema = schemaWith(
				validated(
					(ctx: typeof context, info) => {
						seen.context = ctx;
						seen.field = info.fieldName;
						return { name: z.string().toUpperCase() };
					},
					(_, { name }) => name,
				),
				claimSdl,
			);
			expect(await run(schema, context)).toEqual({ data: { claim: 'ADA' } });
			expect(seen.context).toBe(context);
			expect(seen.field).toBe('claim');
		});

		test('calls it on each call', async () => {
			let calls = 0;
			const schema = schemaWith(
				validated(
					() => {
						calls += 1;
						return { name: z.string() };
					},
					(_, { name }) => name,
				),
				claimSdl,
			);
			await run(schema);
			await run(schema);
			expect(calls).toBe(2);
		});

		test('takes a promise of the schema', async () => {
			const schema = schemaWith(
				validated(
					async () => z.object({ name: z.string().trim() }),
					(_, { name }) => name,
				),
				claimSdl,
			);
			expect(
				await graphql({ schema, source: '{ claim(name: " ada ") }' }),
			).toEqual({ data: { claim: 'ada' } });
		});

		test('takes a shape, transforms applied', async () => {
			const schema = schemaWith(
				validated(
					() => ({ name: z.string().transform((name) => name.length) }),
					(_, { name }) => name,
				),
				'type Query { claim(name: String!): Int }',
			);
			expect(await run(schema)).toEqual({ data: { claim: 3 } });
		});

		test('refuses with BAD_USER_INPUT when a refinement reading the context fails', async () => {
			const schema = schemaWith(
				validated(
					(ctx: { taken: Set<string> }) => ({
						name: z
							.string()
							.refine(async (name) => !ctx.taken.has(name), 'already taken'),
					}),
					(_, { name }) => name,
				),
				claimSdl,
			);
			expect(await run(schema, { taken: new Set() })).toEqual({
				data: { claim: 'ada' },
			});
			const result = await run(schema, { taken: new Set(['ada']) });
			expect(result.errors?.[0]?.message).toBe(
				'Invalid arguments for Query.claim. name: already taken',
			);
			expect(result.errors?.[0]?.extensions).toEqual({
				code: 'BAD_USER_INPUT',
				issues: [{ path: ['name'], message: 'already taken', code: 'custom' }],
			});
		});

		test('lets what it throws reach the client as it is, without running the resolver', async () => {
			let ran = false;
			const schema = schemaWith(
				validated(
					() => {
						throw new Error('not signed in');
					},
					() => {
						ran = true;
						return 'x';
					},
				),
				claimSdl,
			);
			const result = await run(schema);
			expect(result.errors?.[0]?.message).toBe('not signed in');
			expect(result.errors?.[0]?.extensions?.['code']).toBeUndefined();
			expect(ran).toBe(false);
		});

		test('lets what an async one rejects with reach the client, without running the resolver', async () => {
			let ran = false;
			const schema = schemaWith(
				validated(
					async () => {
						throw new Error('session expired');
					},
					() => {
						ran = true;
						return 'x';
					},
				),
				claimSdl,
			);
			const result = await run(schema);
			expect(result.errors?.[0]?.message).toBe('session expired');
			expect(ran).toBe(false);
		});
	});
});
