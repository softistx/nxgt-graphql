import { describe, expect, test } from 'bun:test';
import { buildSchema, GraphQLError, graphql } from 'graphql';
import { z } from 'zod';
import type { ConstraintValue, ValidationIssue } from './bad-user-input';
import { badUserInput } from './bad-user-input';
import { constraintTypeDefs } from './constraint-directive';
import { invalidInputOf } from './invalid-input-of';
import type { ConstraintArgument } from './rules';
import { withValidation } from './with-validation';

const refusal = (issues: ValidationIssue[]) =>
	new GraphQLError('Invalid arguments for Mutation.signUp.', {
		extensions: { code: 'BAD_USER_INPUT', issues },
	});

const issue = (
	constraint: ConstraintArgument | undefined,
	value?: ConstraintValue,
): ValidationIssue => {
	const base = {
		path: ['input', 'person', 'name'],
		message: 'refused',
		code: 'custom',
	};
	return constraint && value !== undefined
		? { ...base, constraint, value }
		: base;
};

const fieldsOf = (error: GraphQLError) => error.extensions['fields'];

describe('invalidInputOf', () => {
	test.each([
		['minLength', 2, 'too-short', { min: 2 }],
		['maxLength', 100, 'too-long', { max: 100 }],
		['min', 1, 'out-of-range', { min: 1 }],
		['max', 50, 'out-of-range', { max: 50 }],
		['exclusiveMin', 0, 'out-of-range', { exclusiveMin: 0 }],
		['exclusiveMax', 10, 'out-of-range', { exclusiveMax: 10 }],
		['multipleOf', 5, 'out-of-range', { multipleOf: 5 }],
		['minItems', 1, 'too-few', { min: 1 }],
		['maxItems', 3, 'too-many', { max: 3 }],
		['format', 'email', 'invalid-format', { format: 'email' }],
		['pattern', '^a', 'invalid-format', undefined],
		['startsWith', 'a', 'invalid', undefined],
		['endsWith', 'a', 'invalid', undefined],
		['contains', 'a', 'invalid', undefined],
		['notContains', 'a', 'invalid', undefined],
	] as const)(
		'%s is validation.errors.%s',
		(constraint, value, code, params) => {
			const error = invalidInputOf(refusal([issue(constraint, value)]));
			expect(error.extensions['code']).toBe('validation.errors.invalid-input');
			expect(fieldsOf(error)).toEqual([
				{
					path: 'person.name',
					code: `validation.errors.${code}`,
					message: `validation.errors.${code}`,
					...(params && { params }),
				},
			]);
		},
	);

	test('a refusal with no constraint is validation.errors.invalid', () => {
		const error = invalidInputOf(refusal([issue(undefined)]));
		expect(fieldsOf(error)).toEqual([
			{
				path: 'person.name',
				code: 'validation.errors.invalid',
				message: 'validation.errors.invalid',
			},
		]);
	});

	test('a format keeps its name as { format }', () => {
		const error = invalidInputOf(refusal([issue('format', 'uuid')]));
		expect(fieldsOf(error)).toEqual([
			expect.objectContaining({
				code: 'validation.errors.invalid-format',
				params: { format: 'uuid' },
			}),
		]);
	});

	test('a pattern keeps no params, so the regex never reaches a client', () => {
		const error = invalidInputOf(refusal([issue('pattern', '^a')]));
		expect(fieldsOf(error)).toEqual([
			{
				path: 'person.name',
				code: 'validation.errors.invalid-format',
				message: 'validation.errors.invalid-format',
			},
		]);
	});

	test('lists every issue in order', () => {
		const error = invalidInputOf(
			refusal([
				issue('minLength', 2),
				{ ...issue('format', 'email'), path: ['input', 'email'] },
			]),
		);
		expect((fieldsOf(error) as { path: string }[]).map((f) => f.path)).toEqual([
			'person.name',
			'email',
		]);
	});

	test('a BAD_USER_INPUT error is converted and kept as originalError', () => {
		const direct = refusal([issue('maxLength', 5)]);
		const error = invalidInputOf(direct);
		expect(error.originalError).toBe(direct);
	});

	test('an error of another code wrapping a BAD_USER_INPUT one is converted from its originalError', () => {
		const thrown = refusal([issue('max', 9)]);
		const wrapped = new GraphQLError(thrown.message, {
			path: ['signUp'],
			originalError: thrown,
			extensions: { code: 'OTHER' },
		});
		const error = invalidInputOf(wrapped);
		expect(fieldsOf(error)).toEqual([
			expect.objectContaining({
				code: 'validation.errors.out-of-range',
				params: { max: 9 },
			}),
		]);
		expect(error.path).toEqual(['signUp']);
		expect(error.originalError).toBe(wrapped);
	});

	test('translate words each field from its code and params', () => {
		const error = invalidInputOf(refusal([issue('maxLength', 100)]), {
			translate: (code, params) => `${code} ${JSON.stringify(params)}`,
		});
		expect(fieldsOf(error)).toEqual([
			expect.objectContaining({
				message: 'validation.errors.too-long {"max":100}',
			}),
		]);
	});

	test('an error badUserInput builds from a Zod parse, with no directive, is validation.errors.invalid', () => {
		const error = badUserInput(
			'Mutation.signUp',
			(z.string().max(2).safeParse('abc') as { error: z.ZodError }).error,
		);
		expect(fieldsOf(invalidInputOf(error))).toEqual([
			expect.objectContaining({ code: 'validation.errors.invalid' }),
		]);
	});

	test.each([
		[
			'another code',
			new GraphQLError('x', { extensions: { code: 'FORBIDDEN' } }),
		],
		['no code', new GraphQLError('x')],
		[
			'BAD_USER_INPUT with no issues',
			new GraphQLError('x', { extensions: { code: 'BAD_USER_INPUT' } }),
		],
	])('%s is returned as it is', (_, error) => {
		expect(invalidInputOf(error)).toBe(error);
	});

	test('a refusal of a withValidation schema, end to end', async () => {
		const schema = withValidation(
			buildSchema(`${constraintTypeDefs}
				type Query { a: Int }
				type Mutation { count(n: Int! @constraint(exclusiveMin: 0)): Int }`),
		);
		const result = await graphql({
			schema,
			source: 'mutation { count(n: 0) }',
		});
		const error = invalidInputOf(result.errors?.[0] as GraphQLError);
		expect(error.extensions['code']).toBe('validation.errors.invalid-input');
		expect(error.path).toEqual(['count']);
		expect(fieldsOf(error)).toEqual([
			{
				path: 'n',
				code: 'validation.errors.out-of-range',
				message: 'validation.errors.out-of-range',
				params: { exclusiveMin: 0 },
			},
		]);
	});
});
