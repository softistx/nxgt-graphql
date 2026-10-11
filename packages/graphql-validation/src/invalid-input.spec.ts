import { describe, expect, test } from 'bun:test';
import { GraphQLError } from 'graphql';
import {
	type FieldIssue,
	fieldsError,
	INVALID_INPUT,
	inputPath,
	invalidInputError,
	type Translate,
} from './invalid-input';

const texts: Record<string, string> = {
	'validation.errors.invalid-input': 'Invalid input',
	'validation.errors.required': 'Required',
	'validation.errors.too-short': 'At least {min} characters',
	'person.errors.email-taken': 'This email is taken',
	'person.errors.duplicate': 'Already registered as {name}',
};
const translate: Translate = (code, params) =>
	(texts[code] ?? code).replace(/\{(\w+)\}/g, (_, key: string) =>
		String(params?.[key]),
	);

const issues: FieldIssue[] = [
	{ path: 'person.lastName', code: 'validation.errors.required' },
	{
		path: 'person.firstName',
		code: 'validation.errors.too-short',
		params: { min: 2 },
	},
];

describe('invalidInputError', () => {
	test('without translate, every message is its code', () => {
		expect(invalidInputError(issues).toJSON()).toEqual({
			message: 'validation.errors.invalid-input',
			extensions: {
				code: 'validation.errors.invalid-input',
				http: { status: 400 },
				fields: [
					{
						path: 'person.lastName',
						code: 'validation.errors.required',
						message: 'validation.errors.required',
					},
					{
						path: 'person.firstName',
						code: 'validation.errors.too-short',
						message: 'validation.errors.too-short',
						params: { min: 2 },
					},
				],
			},
		});
	});

	test('with translate, the error and each field are translated', () => {
		expect(invalidInputError(issues, { translate }).toJSON()).toEqual({
			message: 'Invalid input',
			extensions: {
				code: 'validation.errors.invalid-input',
				http: { status: 400 },
				fields: [
					{
						path: 'person.lastName',
						code: 'validation.errors.required',
						message: 'Required',
					},
					{
						path: 'person.firstName',
						code: 'validation.errors.too-short',
						message: 'At least 2 characters',
						params: { min: 2 },
					},
				],
			},
		});
	});

	test('the JSON keys come in a stable order', () => {
		const json = invalidInputError(issues).toJSON();
		expect(Object.keys(json.extensions ?? {})).toEqual([
			'code',
			'http',
			'fields',
		]);
		const fields = (json.extensions?.['fields'] ?? []) as object[];
		expect(fields.map((field) => Object.keys(field))).toEqual([
			['path', 'code', 'message'],
			['path', 'code', 'message', 'params'],
		]);
	});

	test('the code is exported', () => {
		expect(invalidInputError([]).extensions['code']).toBe(INVALID_INPUT);
	});

	test('params are never {}: an empty object is omitted', () => {
		const error = invalidInputError([
			{ path: 'a', code: 'x', params: {} },
			{ path: 'b', code: 'y', params: { max: 'z' } },
		]);
		expect(error.extensions['fields']).toEqual([
			{ path: 'a', code: 'x', message: 'x' },
			{ path: 'b', code: 'y', message: 'y', params: { max: 'z' } },
		]);
		const [first] = error.extensions['fields'] as object[];
		expect(first).not.toHaveProperty('params');
	});

	test('translate receives params only when there are some', () => {
		const calls: unknown[][] = [];
		invalidInputError(
			[
				{ path: 'a', code: 'x' },
				{ path: 'b', code: 'y', params: {} },
				{ path: 'c', code: 'z', params: { min: 1 } },
			],
			{
				translate: (...args) => {
					calls.push(args);
					return 'text';
				},
			},
		);
		expect(calls).toEqual([
			['validation.errors.invalid-input', undefined],
			['x', undefined],
			['y', undefined],
			['z', { min: 1 }],
		]);
	});

	test('fields keep the order given, duplicates included', () => {
		const paths = ['z', 'a', 'm', 'a'];
		const error = invalidInputError(paths.map((path) => ({ path, code: 'c' })));
		expect(
			(error.extensions['fields'] as { path: string }[]).map(
				(field) => field.path,
			),
		).toEqual(paths);
	});

	test('a translator returning nothing falls back to the code', () => {
		const silent = (() => undefined) as unknown as Translate;
		const error = invalidInputError([{ path: 'a', code: 'x' }], {
			translate: silent,
		});
		expect(error.message).toBe(INVALID_INPUT);
		expect(error.extensions['fields']).toEqual([
			{ path: 'a', code: 'x', message: 'x' },
		]);
	});

	test("GraphQL's options are kept, their extensions replaced", () => {
		const cause = new Error('zod said no');
		const error = invalidInputError(issues, {
			originalError: cause,
			path: ['createPerson'],
			extensions: { code: 'BAD_USER_INPUT', extra: true },
		});
		expect(error).toBeInstanceOf(GraphQLError);
		expect(error.originalError).toBe(cause);
		expect(error.path).toEqual(['createPerson']);
		expect(error.extensions['code']).toBe(INVALID_INPUT);
		expect(error.extensions).not.toHaveProperty('extra');
		expect(error.toJSON()).toMatchObject({ path: ['createPerson'] });
	});

	test('no field is still the error, with an empty list', () => {
		expect(invalidInputError([]).extensions).toEqual({
			code: INVALID_INPUT,
			http: { status: 400 },
			fields: [],
		});
	});
});

describe('fieldsError', () => {
	const taken: FieldIssue[] = [
		{ path: 'email', code: 'person.errors.email-taken' },
	];

	test('with no status nor params: code and fields only', () => {
		expect(fieldsError('person.errors.duplicate', taken).toJSON()).toEqual({
			message: 'person.errors.duplicate',
			extensions: {
				code: 'person.errors.duplicate',
				fields: [
					{
						path: 'email',
						code: 'person.errors.email-taken',
						message: 'person.errors.email-taken',
					},
				],
			},
		});
	});

	test('with status, params and translate', () => {
		const json = fieldsError('person.errors.duplicate', taken, {
			translate,
			status: 409,
			params: { name: 'Ada' },
		}).toJSON();
		expect(json).toEqual({
			message: 'Already registered as Ada',
			extensions: {
				code: 'person.errors.duplicate',
				params: { name: 'Ada' },
				http: { status: 409 },
				fields: [
					{
						path: 'email',
						code: 'person.errors.email-taken',
						message: 'This email is taken',
					},
				],
			},
		});
		expect(Object.keys(json.extensions ?? {})).toEqual([
			'code',
			'params',
			'http',
			'fields',
		]);
	});

	test('a status alone, and empty params omitted', () => {
		expect(
			fieldsError('c', [], { status: 409, params: {} }).extensions,
		).toEqual({ code: 'c', http: { status: 409 }, fields: [] });
	});

	test('params alone, with no http', () => {
		expect(fieldsError('c', [], { params: { n: 1 } }).extensions).toEqual({
			code: 'c',
			params: { n: 1 },
			fields: [],
		});
	});

	test("GraphQL's options are kept, their extensions replaced", () => {
		const cause = new Error('E11000 duplicate key');
		const error = fieldsError('c', taken, {
			originalError: cause,
			path: ['createPerson'],
			extensions: { code: 'CONFLICT' },
		});
		expect(error.originalError).toBe(cause);
		expect(error.path).toEqual(['createPerson']);
		expect(error.extensions['code']).toBe('c');
	});
});

describe('inputPath', () => {
	test.each([
		[['input', 'person', 'firstName'], 'person.firstName'],
		[['input', 'tags', 1], 'tags.1'],
		[['first'], 'first'],
		[['first', 'input'], 'first.input'],
		[['input'], 'input'],
		[['inputs', 'a'], 'inputs.a'],
		[[], ''],
	] as const)('%j is %j', (path, expected) => {
		expect(inputPath(path)).toBe(expected);
	});
});
