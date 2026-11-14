import { describe, expect, test } from 'bun:test';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import type { ConstraintValue, ValidationIssue } from './bad-user-input';
import { badUserInput } from './bad-user-input';
import { constraintInvalidInput } from './constraint-invalid-input';
import type { ConstraintArgument } from './rules';

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

describe('constraintInvalidInput', () => {
	test.each([
		['minLength', 2, 'too-short', { min: 2 }],
		['maxLength', 100, 'too-long', { max: 100 }],
		['min', 1, 'out-of-range', { min: 1 }],
		['max', 50, 'out-of-range', { max: 50 }],
		['exclusiveMin', 0, 'out-of-range', { min: 0 }],
		['exclusiveMax', 10, 'out-of-range', { max: 10 }],
		['multipleOf', 5, 'out-of-range', undefined],
		['minItems', 1, 'too-few', { min: 1 }],
		['maxItems', 3, 'too-many', { max: 3 }],
		['format', 'email', 'invalid-format', undefined],
		['pattern', '^a', 'invalid-format', undefined],
		['startsWith', 'a', 'invalid', undefined],
		['endsWith', 'a', 'invalid', undefined],
		['contains', 'a', 'invalid', undefined],
		['notContains', 'a', 'invalid', undefined],
	] as const)(
		'%s is validation.errors.%s',
		(constraint, value, code, params) => {
			const error = constraintInvalidInput(refusal([issue(constraint, value)]));
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
		const error = constraintInvalidInput(refusal([issue(undefined)]));
		expect(fieldsOf(error)).toEqual([
			{
				path: 'person.name',
				code: 'validation.errors.invalid',
				message: 'validation.errors.invalid',
			},
		]);
	});

	test('a constraint declared with text keeps no numeric bound', () => {
		const error = constraintInvalidInput(refusal([issue('minLength', 'x')]));
		expect(fieldsOf(error)).toEqual([
			expect.objectContaining({
				code: 'validation.errors.too-short',
				params: { min: 'x' },
			}),
		]);
	});

	test('lists every issue in order', () => {
		const error = constraintInvalidInput(
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

	test('the direct branch keeps the refusal as originalError', () => {
		const direct = refusal([issue('maxLength', 5)]);
		const error = constraintInvalidInput(direct);
		expect(error.originalError).toBe(direct);
	});

	test('the wrapped branch reads the error graphql-js wrapped', () => {
		const thrown = refusal([issue('max', 9)]);
		const wrapped = new GraphQLError(thrown.message, {
			path: ['signUp'],
			originalError: thrown,
		});
		const error = constraintInvalidInput(wrapped);
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
		const error = constraintInvalidInput(refusal([issue('maxLength', 100)]), {
			translate: (code, params) => `${code} ${JSON.stringify(params)}`,
		});
		expect(fieldsOf(error)).toEqual([
			expect.objectContaining({
				message: 'validation.errors.too-long {"max":100}',
			}),
		]);
	});

	test('works on the error badUserInput builds, bound read from the directive', () => {
		const error = badUserInput(
			'Mutation.signUp',
			(z.string().max(2).safeParse('abc') as { error: z.ZodError }).error,
		);
		// No directive: no constraint, so the generic code.
		expect(fieldsOf(constraintInvalidInput(error))).toEqual([
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
		expect(constraintInvalidInput(error)).toBe(error);
	});
});
