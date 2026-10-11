import { describe, expect, test } from 'bun:test';
import * as validation from '@nxgt/graphql-validation';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import {
	badUserInputRefusal,
	errorResponse,
	fieldIssueOf,
	fieldsError,
	inputPath,
	invalidInputError,
	invalidInputRefusal,
	isGraphQLError,
} from './index';

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

describe("@nxgt/graphql-validation's builders", () => {
	test('are re-exported as they are', () => {
		expect(fieldIssueOf).toBe(validation.fieldIssueOf);
		expect(invalidInputError).toBe(validation.invalidInputError);
		expect(fieldsError).toBe(validation.fieldsError);
		expect(inputPath).toBe(validation.inputPath);
	});

	test('map the issues as the default answer does', async () => {
		const issues = issuesOf(signUp, {
			input: { person: { firstName: 'A', email: 'x' }, tags: ['a', 'b'] },
		});
		const { error } = await invalidInputRefusal()(issues, {
			type: 'mutation',
			name: 'SignUp',
		});
		expect(error.extensions).toEqual(
			invalidInputError(issues.map(fieldIssueOf)).extensions,
		);
		expect(issues.map(fieldIssueOf).map(({ path }) => path)).toEqual([
			'person.firstName',
			'person.email',
			'tags',
		]);
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

	test('takes a list, the highest status answering, as graphql-yoga does', async () => {
		const response = errorResponse([
			{ message: 'a' },
			{ message: 'b', extensions: { http: { status: 401 } } },
			{ message: 'c', extensions: { http: { status: 403 } } },
			{ message: 'd', extensions: { http: { status: 400 } } },
		]);
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			errors: [
				{ message: 'a' },
				{ message: 'b' },
				{ message: 'c' },
				{ message: 'd' },
			],
		});
	});

	test('leaves extensions.http and extensions.unexpected out of the body, as graphql-yoga does', async () => {
		const thrown = new GraphQLError('taken', {
			extensions: { code: 'TAKEN', http: { status: 409 }, unexpected: true },
		});
		expect(await errorResponse(thrown).json()).toEqual({
			errors: [{ message: 'taken', extensions: { code: 'TAKEN' } }],
		});
	});

	test('ignores a status given that a response cannot carry', () => {
		const conflict = { message: 'a', extensions: { http: { status: 409 } } };
		for (const status of [99, 204, 600, 409.5]) {
			expect(errorResponse(conflict, { status }).status).toBe(409);
			expect(errorResponse({ message: 'a' }, { status }).status).toBe(200);
		}
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
