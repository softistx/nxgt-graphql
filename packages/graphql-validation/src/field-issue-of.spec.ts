import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { FIELD_CODES, fieldIssueOf } from './field-issue-of';

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
		['a prefix', z.string().startsWith('a'), 'b', 'invalid'],
		['a suffix', z.string().endsWith('a'), 'b', 'invalid'],
		['a substring', z.string().includes('a'), 'b', 'invalid'],
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

	test('writes a symbol key as String(key)', () => {
		const key = Symbol('tag');
		expect(
			fieldIssueOf({
				code: 'custom',
				message: 'no',
				input: 1,
				path: ['input', key, 0],
			}).path,
		).toBe('Symbol(tag).0');
	});
});

describe('FIELD_CODES', () => {
	test('are the codes agreed with the API, under validation.errors.', () => {
		expect(Object.values(FIELD_CODES)).toEqual([
			'validation.errors.too-short',
			'validation.errors.too-long',
			'validation.errors.out-of-range',
			'validation.errors.too-few',
			'validation.errors.too-many',
			'validation.errors.invalid-format',
			'validation.errors.invalid',
		]);
	});
});
