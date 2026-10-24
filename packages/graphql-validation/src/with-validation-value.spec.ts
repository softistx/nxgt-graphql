import { describe, expect, test } from 'bun:test';
import { buildSchema, type GraphQLObjectType, graphql } from 'graphql';
import { z } from 'zod';
import { constraintTypeDefs } from './constraint-directive';
import { validated } from './validated';
import { withValidation } from './with-validation';

const sdl = `${constraintTypeDefs}
	input CreateItemInput {
		name: String! @constraint(maxLength: 100)
		count: Int @constraint(min: 3)
		code: String @constraint(pattern: "^[A-Z]{3}$")
		contact: String @constraint(format: "email")
		tags: [String!] @constraint(maxItems: 2, startsWith: "t-")
		ratio: Float @constraint(multipleOf: 0.5)
	}
	type Query { ping: String }
	type Mutation { createItem(input: CreateItemInput!): Boolean }
`;

function server() {
	const schema = buildSchema(sdl);
	const fields = (schema.getMutationType() as GraphQLObjectType).getFields();
	(fields['createItem'] as { resolve?: unknown }).resolve = () => true;
	return withValidation(schema);
}

async function issuesOf(input: string) {
	const result = await graphql({
		schema: server(),
		source: `mutation { createItem(input: ${input}) }`,
	});
	return result.errors?.[0]?.extensions?.['issues'] as
		| Record<string, unknown>[]
		| undefined;
}

describe('the declared value on each issue', () => {
	test('a maxLength issue carries the number it was declared with', async () => {
		const issues = await issuesOf(`{ name: "${'x'.repeat(101)}" }`);
		expect(issues?.[0]).toMatchObject({
			path: ['input', 'name'],
			code: 'too_big',
			constraint: 'maxLength',
			value: 100,
		});
	});

	test('a min issue carries its number', async () => {
		const issues = await issuesOf('{ name: "a", count: 1 }');
		expect(issues?.[0]).toMatchObject({ constraint: 'min', value: 3 });
	});

	test('a Float multipleOf carries it as declared', async () => {
		const issues = await issuesOf('{ name: "a", ratio: 0.7 }');
		expect(issues?.[0]).toMatchObject({ constraint: 'multipleOf', value: 0.5 });
	});

	test('a pattern issue carries its string', async () => {
		const issues = await issuesOf('{ name: "a", code: "abc" }');
		expect(issues?.[0]).toMatchObject({
			constraint: 'pattern',
			value: '^[A-Z]{3}$',
		});
	});

	test('a format issue carries the format name', async () => {
		const issues = await issuesOf('{ name: "a", contact: "nope" }');
		expect(issues?.[0]).toMatchObject({ constraint: 'format', value: 'email' });
	});

	test('a list rule and an item rule each carry their own value', async () => {
		const issues = await issuesOf('{ name: "a", tags: ["t-1", "x", "t-3"] }');
		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ['input', 'tags', 1],
				constraint: 'startsWith',
				value: 't-',
			}),
		);
		const list = await issuesOf('{ name: "a", tags: ["t-1", "t-2", "t-3"] }');
		expect(list?.[0]).toMatchObject({
			path: ['input', 'tags'],
			constraint: 'maxItems',
			value: 2,
		});
	});

	test('a validated() issue has neither constraint nor value', async () => {
		const schema = buildSchema('type Query { ping(word: String): String }');
		const fields = (schema.getQueryType() as GraphQLObjectType).getFields();
		(fields['ping'] as { resolve?: unknown }).resolve = validated(
			z.object({ word: z.string().min(5) }),
			() => 'pong',
		);
		const result = await graphql({
			schema,
			source: '{ ping(word: "ab") }',
		});
		const issues = result.errors?.[0]?.extensions?.['issues'] as object[];
		const [issue] = issues;
		expect(issue).not.toHaveProperty('constraint');
		expect(issue).not.toHaveProperty('value');
	});
});
