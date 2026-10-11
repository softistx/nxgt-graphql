import { describe, expect, test } from 'bun:test';
import { parse } from 'graphql';
import { createGraphQLClient } from './client';
import {
	ApiError,
	ApiStatusError,
	ApiUnavailableError,
	isApiError,
} from './errors';

describe('ApiError', () => {
	test('its summaries read the first error', () => {
		const error = new ApiError(
			[
				{
					message: 'First',
					extensions: {
						code: 'FIRST',
						http: { status: 409 },
						params: { max: 3 },
						retryAfter: 30,
					},
				},
				{ message: 'Second', extensions: { code: 'SECOND' } },
			],
			undefined,
			200,
		);
		expect(error.message).toBe('First');
		expect(error.code).toBe('FIRST');
		expect(error.status).toBe(409);
		expect(error.params).toEqual({ max: 3 });
		expect(error.extensions['retryAfter']).toBe(30);
		expect(error.errors).toHaveLength(2);
	});

	test('without extensions: no code, the HTTP status, no params, no fields', () => {
		const error = new ApiError([{ message: 'Oops' }], undefined, 500);
		expect(error.extensions).toEqual({});
		expect(error.code).toBeUndefined();
		expect(error.status).toBe(500);
		expect(error.params).toEqual({});
		expect(error.fields).toEqual([]);
	});

	test('the status falls back to the HTTP status when extensions.http has none', () => {
		const error = new ApiError(
			[{ message: 'x', extensions: { http: {} } }],
			undefined,
			422,
		);
		expect(error.status).toBe(422);
		expect(error.httpStatus).toBe(422);
	});

	test('fields from extensions.fields keep their paths as strings', () => {
		const fields = [
			{ path: 'ids.3', code: 'archived', message: 'Archived' },
			{ path: 'person.firstName', code: 'required', message: 'Required' },
		];
		const error = new ApiError(
			[{ message: 'x', extensions: { fields } }],
			undefined,
			400,
		);
		expect(error.fields).toEqual(fields);
		expect(error.fields[0]?.path).toBe('ids.3');
	});

	test('fields from graphql-validation issues join their paths with dots', () => {
		const error = new ApiError(
			[
				{
					message: 'x',
					extensions: {
						issues: [
							{ path: ['input', 'ids', 3], code: 'too_small', message: 'Low' },
							{ path: 'single', code: 'c', message: 'm' },
							{ code: 'nopath', message: 'm' },
							'not an issue',
							null,
						],
					},
				},
			],
			undefined,
			400,
		);
		expect(error.fields).toEqual([
			{ path: 'input.ids.3', code: 'too_small', message: 'Low' },
			{ path: 'single', code: 'c', message: 'm' },
			{ path: '', code: 'nopath', message: 'm' },
		]);
	});

	test('extensions.fields wins over extensions.issues', () => {
		const fields = [{ path: 'a', code: 'c', message: 'm' }];
		const error = new ApiError(
			[
				{
					message: 'x',
					extensions: {
						fields,
						issues: [{ path: ['b'], code: 'c', message: 'm' }],
					},
				},
			],
			undefined,
			400,
		);
		expect(error.fields).toEqual(fields);
	});

	test('data null with errors leaves error.data undefined', async () => {
		// As the client builds it from a response of `{ data: null, errors }`.
		const client = createGraphQLClient({
			url: 'https://api.test/graphql',
			fetch: () =>
				new Response(
					JSON.stringify({ data: null, errors: [{ message: 'Nope' }] }),
					{ headers: { 'content-type': 'application/json' } },
				),
		});
		const error = (await client
			.query(parse('query Q { a }') as never)
			.catch((e: unknown) => e)) as ApiError;
		expect(error).toBeInstanceOf(ApiError);
		expect(error.data).toBeUndefined();
	});

	test('an empty errors array has a default message', () => {
		expect(new ApiError([], undefined, 500).message).toBe(
			'Unknown GraphQL error',
		);
	});
});

describe('isApiError', () => {
	test('true for an ApiError', () => {
		expect(isApiError(new ApiError([{ message: 'x' }], undefined, 200))).toBe(
			true,
		);
	});

	test("true through the name for another copy's error carrying errors", () => {
		const foreign = Object.assign(new Error('x'), {
			name: 'ApiError',
			errors: [{ message: 'x' }],
		});
		expect(foreign).not.toBeInstanceOf(ApiError);
		expect(isApiError(foreign)).toBe(true);
	});

	test('false for a named error without errors, and for anything else', () => {
		const named = Object.assign(new Error('x'), { name: 'ApiError' });
		expect(isApiError(named)).toBe(false);
		expect(isApiError(new Error('x'))).toBe(false);
		expect(isApiError({ name: 'ApiError', errors: [] })).toBe(false);
		expect(isApiError(null)).toBe(false);
		expect(isApiError('ApiError')).toBe(false);
	});
});

describe('ApiStatusError', () => {
	test('keeps its status and body', () => {
		const error = new ApiStatusError(503, 'down');
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('ApiStatusError');
		expect(error.status).toBe(503);
		expect(error.body).toBe('down');
		expect(error.message).toBe('The API answered 503 with no GraphQL response');
	});
});

describe('ApiUnavailableError', () => {
	test.each([
		['unreachable', 'The API could not be reached'],
		['timeout', 'The API did not answer in time'],
		['invalid-response', 'The API answered with neither data nor errors'],
	] as const)('%s', (reason, message) => {
		const cause = new Error('why');
		const error = new ApiUnavailableError(reason, { cause });
		expect(error.name).toBe('ApiUnavailableError');
		expect(error.reason).toBe(reason);
		expect(error.message).toBe(message);
		expect(error.cause).toBe(cause);
	});
});
