import { describe, expect, test } from 'bun:test';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { coercionErrors, isCoercionIssue } from './coercion';
import {
	badUserInputRefusal,
	errorResponse,
	fieldIssueOf,
	invalidInputRefusal,
	isGraphQLError,
} from './index';
import { inspect } from './inspect';

const issuesOf = (schema: z.ZodType, value: unknown) => {
	const result = schema.safeParse(value);
	if (result.success) throw new Error('expected a refusal');
	return result.error.issues;
};

const signUp = z.object({
	input: z.object({
		person: z.object({ firstName: z.string().min(2), email: z.email() }),
		tags: z.array(z.string()).max(1).nullish(),
	}),
});

describe('fieldIssueOf', () => {
	const codeOf = (schema: z.ZodType, value: unknown) =>
		issuesOf(z.object({ v: schema }), { v: value }).map(fieldIssueOf);

	test.each([
		['a string too short', z.string().min(2), 'a', 'too-short'],
		['a string of an exact length', z.string().length(3), 'ab', 'too-short'],
		['a string too long', z.string().max(2), 'abc', 'too-long'],
		['a number below its minimum', z.number().gte(1), 0, 'out-of-range'],
		['a number above its maximum', z.number().lte(50), 51, 'out-of-range'],
		['an int below its minimum', z.int32().gte(1), 0, 'out-of-range'],
		['a bigint above its maximum', z.bigint().max(2n), 3n, 'out-of-range'],
		['a number not a multiple', z.number().multipleOf(2), 3, 'out-of-range'],
		['a list too short', z.array(z.string()).min(2), ['a'], 'too-few'],
		['a list too long', z.array(z.string()).max(1), ['a', 'b'], 'too-many'],
		['a set too small', z.set(z.string()).min(2), new Set(['a']), 'too-few'],
		[
			'a set too big',
			z.set(z.string()).max(1),
			new Set(['a', 'b']),
			'too-many',
		],
		['a format', z.email(), 'nope', 'invalid-format'],
		['a pattern', z.string().regex(/^a/), 'b', 'invalid-format'],
		[
			'a date too early',
			z.date().min(new Date(2020, 0, 1)),
			new Date(2000, 0, 1),
			'invalid',
		],
		['a refinement', z.string().refine(() => false), 'a', 'invalid'],
		['a wrong type, when called directly', z.string(), 1, 'invalid'],
	])('%s is validation.errors.%s', (_, schema, value, code) => {
		expect(codeOf(schema, value)).toEqual([
			{ path: 'v', code: `validation.errors.${code}` },
		]);
	});

	test('drops the leading input and writes no params', () => {
		const issues = issuesOf(signUp, {
			input: { person: { firstName: 'A', email: 'x' }, tags: ['a', 'b'] },
		});
		expect(issues.map(fieldIssueOf)).toEqual([
			{ path: 'person.firstName', code: 'validation.errors.too-short' },
			{ path: 'person.email', code: 'validation.errors.invalid-format' },
			{ path: 'tags', code: 'validation.errors.too-many' },
		]);
	});

	test('reads a list index as a path segment', () => {
		const [issue] = issuesOf(z.object({ ids: z.array(z.string().min(2)) }), {
			ids: ['ab', 'c'],
		});
		expect(issue && fieldIssueOf(issue).path).toBe('ids.1');
	});
});

describe('isCoercionIssue', () => {
	const coercion = (schema: z.ZodType, value: unknown) =>
		issuesOf(schema, value).map(isCoercionIssue);
	const tags = z.union([
		z.array(z.string()).max(2),
		z
			.string()
			.transform((value): unknown[] => [value])
			.pipe(z.array(z.string()).max(2)),
	]);

	test('a missing, null or wrongly typed value, an unknown enum value or field', () => {
		const person = z.strictObject({ name: z.string(), role: z.enum(['A']) });
		expect(coercion(person, { role: 'A' })).toEqual([true]);
		expect(coercion(person, { name: null, role: 'A' })).toEqual([true]);
		expect(coercion(person, { name: 1, role: 'A' })).toEqual([true]);
		expect(coercion(person, { name: 'a', role: 'B' })).toEqual([true]);
		expect(coercion(person, { name: 'a', role: 'A', age: 1 })).toEqual([true]);
	});

	test("an Int beyond 32 bits, which GraphQL's Int refuses", () => {
		expect(coercion(z.int32(), 2 ** 31)).toEqual([true]);
		expect(coercion(z.int32(), -(2 ** 31) - 1)).toEqual([true]);
	});

	test('a union, when every branch failed on one of those', () => {
		expect(coercion(tags, 5)).toEqual([true]);
		expect(coercion(tags, [1])).toEqual([true]);
	});

	test('not a constraint: a bound, a format, a list too long', () => {
		expect(coercion(z.string().min(2), 'a')).toEqual([false]);
		expect(coercion(z.email(), 'x')).toEqual([false]);
		expect(coercion(tags, ['a', 'b', 'c'])).toEqual([false]);
	});
});

describe('coercionErrors', () => {
	const variables = z.object({ ids: z.array(z.string()) });

	test("names a list item's type from the document", () => {
		const sent = { ids: ['a', 2] };
		expect(
			coercionErrors(issuesOf(variables, sent), {
				query: 'query Q($ids: [ID!]!) { q(ids: $ids) }',
				operationName: 'Q',
				variables: sent,
			}),
		).toEqual([
			{
				message:
					'Variable "$ids" got invalid value 2 at "ids[1]"; ID cannot represent value: 2',
				locations: [{ line: 1, column: 9 }],
			},
		]);
	});

	test('without a document it parses, no type and no locations', () => {
		const sent = {};
		expect(
			coercionErrors(issuesOf(variables, sent), {
				query: 'not graphql',
				operationName: 'Q',
				variables: sent,
			}),
		).toEqual([
			{ message: 'Variable "$ids" of required type was not provided.' },
		]);
	});
});

describe('inspect', () => {
	test("prints a value as graphql-js's error messages do", () => {
		expect(inspect('a')).toBe('"a"');
		expect(inspect({ a: [1, 'b'], c: null, d: {}, e: [] })).toBe(
			'{ a: [1, "b"], c: null, d: {}, e: [] }',
		);
		expect(inspect({ a: { b: { c: { d: 1 } } } })).toBe(
			'{ a: { b: { c: [Object] } } }',
		);
		expect(inspect([[[[1]]]])).toBe('[[[[Array]]]]');
	});
});

describe('invalidInputRefusal', () => {
	test("is invalidInputError's 400, the message its code without translate", async () => {
		const issues = issuesOf(z.object({ id: z.string().min(3) }), { id: 'a' });
		const { error, status } = await invalidInputRefusal()(issues, {
			type: 'query',
			name: 'User',
		});
		expect(status).toBe(400);
		expect(error.message).toBe('validation.errors.invalid-input');
		expect(error.extensions).toEqual({
			code: 'validation.errors.invalid-input',
			http: { status: 400 },
			fields: [
				{
					path: 'id',
					code: 'validation.errors.too-short',
					message: 'validation.errors.too-short',
				},
			],
		});
	});

	test('words every message with translate', async () => {
		const issues = issuesOf(z.object({ id: z.string().min(3) }), { id: 'a' });
		const { error } = await invalidInputRefusal({
			translate: (code) => `t(${code})`,
		})(issues, { type: 'query', name: 'User' });
		expect(error.message).toBe('t(validation.errors.invalid-input)');
		expect(
			(error.extensions as { fields: { message: string }[] }).fields[0]
				?.message,
		).toBe('t(validation.errors.too-short)');
	});
});

describe('badUserInputRefusal', () => {
	test("is withValidation's BAD_USER_INPUT, status 200, named after the operation", async () => {
		const issues = issuesOf(z.object({ id: z.string() }), {});
		const { error, status } = await badUserInputRefusal(issues, {
			type: 'query',
			name: 'User',
		});
		expect(status).toBe(200);
		expect(error.message).toBe(
			'Invalid arguments for User. id: Invalid input: expected string, received undefined',
		);
		expect(error.extensions).toEqual({
			code: 'BAD_USER_INPUT',
			issues: [
				{
					path: ['id'],
					message: 'Invalid input: expected string, received undefined',
					code: 'invalid_type',
				},
			],
		});
	});
});

describe('errorResponse', () => {
	test('answers { errors } at the status given, else the error’s, else 200', async () => {
		const conflict = new GraphQLError('taken', {
			extensions: { http: { status: 409 } },
		});
		expect(errorResponse(conflict).status).toBe(409);
		expect(errorResponse(conflict, { status: 422 }).status).toBe(422);
		const plain = errorResponse({ message: 'no' });
		expect(plain.status).toBe(200);
		expect(await plain.json()).toEqual({ errors: [{ message: 'no' }] });
	});

	test('takes a list, the first status found answering', async () => {
		const response = errorResponse([
			{ message: 'a' },
			{ message: 'b', extensions: { http: { status: 401 } } },
		]);
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			errors: [
				{ message: 'a' },
				{ message: 'b', extensions: { http: { status: 401 } } },
			],
		});
	});

	test('ignores a status a response cannot carry: 99, 600, 204, 205, 304', () => {
		for (const status of [99, 600, 204, 205, 304, 409.5])
			expect(
				errorResponse({ message: 'a', extensions: { http: { status } } })
					.status,
			).toBe(200);
		for (const status of [200, 599])
			expect(
				errorResponse({ message: 'a', extensions: { http: { status } } })
					.status,
			).toBe(status);
	});

	test('ignores a status that is not an integer', () => {
		expect(
			errorResponse({ message: 'a', extensions: { http: { status: '409' } } })
				.status,
		).toBe(200);
	});
});

describe('isGraphQLError', () => {
	test('reads the name and toJSON, so another copy of graphql counts', () => {
		class GraphQLErrorCopy extends Error {
			override name = 'GraphQLError';
			toJSON() {
				return { message: this.message };
			}
		}
		expect(isGraphQLError(new GraphQLError('a'))).toBe(true);
		expect(isGraphQLError(new GraphQLErrorCopy('a'))).toBe(true);
		expect(isGraphQLError(new Error('a'))).toBe(false);
		class NotFoundError extends GraphQLError {
			override name = 'NotFoundError';
		}
		expect(isGraphQLError(new NotFoundError('a'))).toBe(true);
		expect(isGraphQLError({ name: 'GraphQLError', message: 'a' })).toBe(false);
	});
});
