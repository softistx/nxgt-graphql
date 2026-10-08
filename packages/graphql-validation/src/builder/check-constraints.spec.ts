import { describe, expect, test } from 'bun:test';
import { buildSchema } from 'graphql';
import { constraintTypeDefs } from '../constraint-directive';
import { checkConstraints } from './check-constraints';

describe('checkConstraints', () => {
	test('returns undefined for a schema that declares no @constraint', () => {
		expect(
			checkConstraints(buildSchema('type Query { a: Int }')),
		).toBeUndefined();
	});

	test('returns the directive, and hands each constrained field its arguments schema', () => {
		const schema = buildSchema(`${constraintTypeDefs}
			type Query { a(n: Int @constraint(min: 1)): Int, b: Int }`);
		const seen: string[] = [];
		const directive = checkConstraints(schema, (type, field, args) => {
			seen.push(`${type.name}.${field.name}`);
			expect(args.safeParse({ n: 0 }).success).toBe(false);
		});
		expect(directive?.name).toBe('constraint');
		expect(seen).toEqual(['Query.a']);
	});

	test('refuses what withValidation refuses, without wrapping anything', () => {
		const sdl = `${constraintTypeDefs}
			directive @cached(ttl: Int @constraint(min: 1)) on FIELD_DEFINITION
			type Query { a: Int }`;
		expect(() => checkConstraints(buildSchema(sdl))).toThrow(
			"@constraint on @cached(ttl:) checks nothing: a directive's argument reaches no resolver. Remove it.",
		);
		expect(() =>
			checkConstraints(
				buildSchema(`${constraintTypeDefs}
					type Query { a(n: Int = 0 @constraint(min: 1)): Int }`),
			),
		).toThrow('The default value of Query.a(n:) breaks its @constraint');
	});
});
