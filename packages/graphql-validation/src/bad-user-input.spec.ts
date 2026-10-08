import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { badUserInput } from './bad-user-input';

const errorOf = (schema: z.ZodType, value: unknown) =>
	schema.safeParse(value).error as z.ZodError;

describe('badUserInput', () => {
	test('names the first issue by its path, list indexes as numbers', () => {
		const error = badUserInput(
			'Mutation.tag',
			errorOf(z.object({ tags: z.array(z.string().min(2)) }), {
				tags: ['ok', 'a'],
			}),
		);
		expect(error.message).toBe(
			'Invalid arguments for Mutation.tag. tags.1: Too small: expected string to have >=2 characters',
		);
		expect(error.extensions).toEqual({
			code: 'BAD_USER_INPUT',
			issues: [
				{
					path: ['tags', 1],
					message: 'Too small: expected string to have >=2 characters',
					code: 'too_small',
				},
			],
		});
	});

	test('says "arguments" for an issue on the arguments as a whole', () => {
		const refined = z.object({}).refine(() => false, 'nope');
		expect(badUserInput('Query.x', errorOf(refined, {})).message).toBe(
			'Invalid arguments for Query.x. arguments: nope',
		);
	});

	test('says "refused" when the error holds no issue', () => {
		expect(badUserInput('Query.x', new z.ZodError([])).message).toBe(
			'Invalid arguments for Query.x. refused',
		);
	});
});
