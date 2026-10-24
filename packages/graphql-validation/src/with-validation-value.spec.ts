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

	test('a list rule carries its own value', async () => {
		const issues = await issuesOf('{ name: "a", tags: ["t-1", "t-2", "t-3"] }');
		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ['input', 'tags'],
				constraint: 'maxItems',
				value: 2,
			}),
		);
	});

	test('an item rule carries its own value', async () => {
		const issues = await issuesOf('{ name: "a", tags: ["t-1", "x"] }');
		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ['input', 'tags', 1],
				constraint: 'startsWith',
				value: 't-',
			}),
		);
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

describe('the declared value, found at every depth', () => {
	const walk = `${constraintTypeDefs}
		input Leaf { name: String! @constraint(maxLength: 2) }
		input Node { kids: [Node!] @constraint(maxItems: 1) }
		input Holder { leaves: [Leaf!] @constraint(maxItems: 1) }
		type Query {
			f(s: String @constraint(minLength: 4)): Boolean
			g(holder: Holder): Boolean
			h(node: Node): Boolean
			n(grid: [[String!]!] @constraint(maxItems: 1, maxLength: 1)): Boolean
		}
	`;

	async function ask(source: string) {
		const schema = buildSchema(walk);
		const fields = (schema.getQueryType() as GraphQLObjectType).getFields();
		for (const name of ['f', 'g', 'h', 'n'])
			(fields[name] as { resolve?: unknown }).resolve = () => true;
		const result = await graphql({ schema: withValidation(schema), source });
		return result.errors?.[0]?.extensions?.['issues'] as
			| Record<string, unknown>[]
			| undefined;
	}

	test('an argument carries its own constraint', async () => {
		expect((await ask('{ f(s: "ab") }'))?.[0]).toMatchObject({
			path: ['s'],
			constraint: 'minLength',
			value: 4,
		});
	});

	test('a list of input objects: the list rule', async () => {
		const issues = await ask(
			'{ g(holder: { leaves: [{ name: "a" }, { name: "b" }] }) }',
		);
		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ['holder', 'leaves'],
				constraint: 'maxItems',
				value: 1,
			}),
		);
	});

	test('a list of input objects: a field inside an item', async () => {
		const issues = await ask('{ g(holder: { leaves: [{ name: "abc" }] }) }');
		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ['holder', 'leaves', 0, 'name'],
				constraint: 'maxLength',
				value: 2,
			}),
		);
	});

	test('a recursive input, a level down', async () => {
		const issues = await ask('{ h(node: { kids: [{ kids: [{}, {}] }] }) }');
		expect(issues?.[0]).toMatchObject({
			path: ['node', 'kids', 0, 'kids'],
			constraint: 'maxItems',
			value: 1,
		});
	});

	test('a nested list: maxItems on the outer list', async () => {
		const issues = await ask('{ n(grid: [["a"], ["b"]]) }');
		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ['grid'],
				constraint: 'maxItems',
				value: 1,
			}),
		);
		expect(
			issues?.filter((issue) => issue['constraint'] === 'maxLength'),
		).toHaveLength(0);
	});

	test('a nested list: maxLength on the items', async () => {
		const issues = await ask('{ n(grid: [["ab"]]) }');
		expect(issues).toContainEqual(
			expect.objectContaining({
				path: ['grid', 0, 0],
				constraint: 'maxLength',
				value: 1,
			}),
		);
		expect(
			issues?.filter((issue) => issue['constraint'] === 'maxItems'),
		).toHaveLength(0);
	});
});
