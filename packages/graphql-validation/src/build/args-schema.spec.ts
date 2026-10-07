import { describe, expect, test } from 'bun:test';
import { buildSchema, type GraphQLObjectType } from 'graphql';
import type { z } from 'zod';
import { constraintTypeDefs } from '../constraint-directive';
import { argsSchemaOf } from './args-schema';
import { InputSchemas } from './input-schema';

/** The args schema of `Query.<field>` in a schema built from `sdl`. */
function argsOf(sdl: string, field = 'check'): z.ZodType | undefined {
	const schema = buildSchema(`${constraintTypeDefs}\n${sdl}`);
	const query = schema.getQueryType() as GraphQLObjectType;
	const inputs = new InputSchemas(schema.getDirective('constraint'));
	return argsSchemaOf(inputs, 'Query', query.getFields()[field] as never);
}

const accepts = (schema: z.ZodType | undefined, value: unknown) =>
	expect(schema?.safeParse(value).success).toBe(true);
const refuses = (schema: z.ZodType | undefined, value: unknown) =>
	expect(schema?.safeParse(value).success).toBe(false);

describe('argsSchemaOf', () => {
	test('leaves a field with nothing to check untouched', () => {
		const sdl =
			'input In { a: String } type Query { check(name: String, input: In): Boolean }';
		expect(argsOf(sdl)).toBeUndefined();
	});

	test('checks a constrained argument, null and absent included when nullable', () => {
		const args = argsOf(
			'type Query { check(name: String @constraint(minLength: 2), id: ID): Boolean }',
		);
		accepts(args, { name: 'ab' });
		accepts(args, { name: null, id: '1' });
		accepts(args, {});
		refuses(args, { name: 'a' });
	});

	test('applies format first, then the rules that narrow it', () => {
		const args = argsOf(
			'type Query { check(email: String! @constraint(maxLength: 12, format: "email")): Boolean }',
		);
		accepts(args, { email: 'ada@ex.co' });
		refuses(args, { email: 'ada' });
		refuses(args, { email: 'ada@example.com' });
	});

	test('reaches nested input fields and reports their path', () => {
		const args = argsOf(`
			input Address { zip: String! @constraint(pattern: "^[0-9]{5}$") }
			input SignUp { name: String, address: Address! }
			type Query { check(input: SignUp!): Boolean }`);
		accepts(args, { input: { name: 'Ada', address: { zip: '75001' } } });
		const result = args?.safeParse({ input: { address: { zip: 'nope' } } });
		expect(result?.error?.issues.map((issue) => issue.path)).toEqual([
			['input', 'address', 'zip'],
		]);
	});

	test('puts minItems on the list and the other rules on its items', () => {
		const args = argsOf(
			'type Query { check(tags: [String!]! @constraint(minItems: 1, maxLength: 3)): Boolean }',
		);
		accepts(args, { tags: ['abc'] });
		refuses(args, { tags: [] });
		refuses(args, { tags: ['abcd'] });
	});

	test('follows a recursive input type', () => {
		const args = argsOf(`
			input Filter { name: String @constraint(minLength: 1), and: [Filter!] }
			type Query { check(filter: Filter): Boolean }`);
		accepts(args, { filter: { and: [{ name: 'a', and: [{ name: 'b' }] }] } });
		refuses(args, { filter: { and: [{ and: [{ name: '' }] }] } });
	});

	test('checks Int and Float with number rules', () => {
		const args = argsOf(
			'type Query { check(age: Int @constraint(min: 18), ratio: Float @constraint(exclusiveMax: 1)): Boolean }',
		);
		accepts(args, { age: 18, ratio: 0.5 });
		refuses(args, { age: 17 });
		refuses(args, { ratio: 1 });
	});

	describe('fails at startup, naming where', () => {
		test('a string rule on an Int', () => {
			expect(() =>
				argsOf(
					'type Query { check(age: Int @constraint(minLength: 1)): Boolean }',
				),
			).toThrow(
				'@constraint(minLength) on Query.check(age:) needs a String or an ID, not Int.',
			);
		});

		test('a list rule on a scalar', () => {
			expect(() =>
				argsOf(
					'type Query { check(name: String @constraint(minItems: 1)): Boolean }',
				),
			).toThrow(
				'@constraint(minItems) on Query.check(name:) needs a list, not String.',
			);
		});

		test('a rule on a custom scalar', () => {
			expect(() =>
				argsOf(`scalar DateTime
					input In { at: DateTime @constraint(maxLength: 3) }
					type Query { check(input: In): Boolean }`),
			).toThrow(
				'@constraint(maxLength) on In.at needs a String or an ID, not DateTime.',
			);
		});

		test('a rule on an input object', () => {
			expect(() =>
				argsOf(`input In { a: String }
					type Query { check(input: In @constraint(minLength: 1)): Boolean }`),
			).toThrow(
				'@constraint(minLength) on Query.check(input:) needs a String or an ID, not In.',
			);
		});

		test('an unknown format', () => {
			expect(() =>
				argsOf(
					'type Query { check(name: String @constraint(format: "siret")): Boolean }',
				),
			).toThrow('Unknown @constraint format "siret"');
		});
	});
});
