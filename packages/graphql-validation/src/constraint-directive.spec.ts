import { describe, expect, test } from 'bun:test';
import { buildSchema, DirectiveLocation } from 'graphql';
import { constraintTypeDefs } from './constraint-directive';

describe('constraintTypeDefs', () => {
	test('declares @constraint on arguments and input fields only', () => {
		const schema = buildSchema(
			`${constraintTypeDefs}\ntype Query { ok: Boolean }`,
		);
		const directive = schema.getDirective('constraint');

		expect(directive?.locations).toEqual([
			DirectiveLocation.ARGUMENT_DEFINITION,
			DirectiveLocation.INPUT_FIELD_DEFINITION,
		]);
	});

	test('accepts graphql-constraint-directive arguments where they apply', () => {
		const sdl = `${constraintTypeDefs}
			input SignUp {
				email: String! @constraint(format: "email", maxLength: 254)
				age: Int @constraint(min: 18, exclusiveMax: 150)
				tags: [String!] @constraint(minItems: 1, maxItems: 5)
			}
			type Query { check(name: String @constraint(minLength: 2, pattern: "^[a-z]+$"), input: SignUp): Boolean }`;

		expect(() => buildSchema(sdl)).not.toThrow();
	});

	test('refuses @constraint on an output field', () => {
		const sdl = `${constraintTypeDefs}\ntype Query { name: String @constraint(maxLength: 3) }`;

		expect(() => buildSchema(sdl)).toThrow(
			'may not be used on FIELD_DEFINITION',
		);
	});
});
