import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { coercionErrors, type InputTypes } from './index';
import { inspect } from './inspect';

const issuesOf = (schema: z.ZodType, value: unknown) => {
	const result = schema.safeParse(value);
	if (result.success) throw new Error('expected a refusal');
	return result.error.issues;
};

describe('coercionErrors', () => {
	const inputTypes: InputTypes = {
		DateTime: { kind: 'scalar' },
		ID: { kind: 'builtin' },
		Int: { kind: 'builtin' },
		Role: { kind: 'enum', values: ['ADMIN', 'MEMBER'] },
		Person: {
			kind: 'input',
			fields: {
				name: 'String!',
				level: 'Int! = 1',
				birth: 'DateTime',
				dates: '[DateTime!]',
			},
		},
		Pick: { kind: 'input', fields: { id: 'ID', name: 'String' }, oneOf: true },
		String: { kind: 'builtin' },
	};
	const dateTime = z.iso.datetime({ offset: true });
	const dates = z.union([
		z.array(dateTime),
		z
			.custom<string>((value) => value != null && !Array.isArray(value))
			.transform((value): unknown[] => [value])
			.pipe(z.array(dateTime)),
	]);
	const person = z.strictObject({
		name: z.string(),
		level: z.int32().optional(),
		birth: dateTime.nullish(),
		dates: dates.nullish(),
	});

	/** The messages for `sent`, against `schema` and the declared types. */
	const messagesOf = (
		schema: z.ZodType,
		variableTypes: Record<string, string>,
		sent: Record<string, unknown>,
	) =>
		coercionErrors(
			issuesOf(schema, sent),
			{ query: 'not graphql', operationName: 'Q', variables: sent },
			{ variableTypes, inputTypes },
		).map((error) => error.message);

	test("decides Int's bound from the declared type, not from a Zod issue", () => {
		const first = z.object({ first: z.int32().lte(50).nullish() });
		for (const value of [1e20, -1e20, 3_000_000_000])
			expect(messagesOf(first, { first: 'Int' }, { first: value })).toEqual([
				`Variable "$first" got invalid value ${String(value)}; Int cannot represent non 32-bit signed integer value: ${String(value)}`,
			]);
		// A constraint's bound is the API's validation: not a coercion.
		expect(messagesOf(first, { first: 'Int' }, { first: 51 })).toEqual([]);
	});

	test('a custom scalar refuses where its schema has an issue, worded as zodScalar words it', () => {
		const variables = z.object({ since: dateTime, person });
		expect(
			messagesOf(
				variables,
				{ since: 'DateTime!', person: 'Person!' },
				{ since: 5, person: { name: 'Ada', birth: 'x' } },
			),
		).toEqual([
			'Variable "$since" got invalid value 5; DateTime cannot represent this input: Invalid input: expected string, received number',
			'Variable "$person" got invalid value "x" at "person.birth"; DateTime cannot represent this input: Invalid ISO datetime',
		]);
	});

	test('a list of custom scalars: an item, or a single value standing for the list', () => {
		const variables = z.object({ person });
		const at = (dates: unknown) =>
			messagesOf(
				variables,
				{ person: 'Person!' },
				{
					person: { name: 'Ada', dates },
				},
			);
		expect(at(['2020-01-01T00:00:00Z', 'x'])).toEqual([
			'Variable "$person" got invalid value "x" at "person.dates[1]"; DateTime cannot represent this input: Invalid ISO datetime',
		]);
		expect(at('x')).toEqual([
			'Variable "$person" got invalid value "x" at "person.dates"; DateTime cannot represent this input: Invalid ISO datetime',
		]);
	});

	test('names nested input types and non-null wrappers as graphql does', () => {
		const variables = z.object({ person, ids: z.array(z.array(z.string())) });
		expect(
			messagesOf(
				variables,
				{ person: 'Person!', ids: '[[ID!]!]!' },
				{ person: { level: null }, ids: [null] },
			),
		).toEqual([
			'Variable "$person" got invalid value { level: null }; Expected value of type "Person" to include required field "name", found: { level: null }.',
			'Variable "$person" got invalid value null at "person.level"; Expected value of non-null type "Int!" not to be null.',
			'Variable "$ids" got invalid value null at "ids[0]"; Expected value of non-null type "[ID!]!" not to be null.',
		]);
	});

	test('words a leaf scalar as graphql does', () => {
		const variables = z.object({ name: z.string(), id: z.string() });
		expect(
			messagesOf(
				variables,
				{ name: 'String!', id: 'ID!' },
				{ name: 1, id: true },
			),
		).toEqual([
			'Variable "$name" got invalid value 1; String cannot represent a non string value: 1',
			'Variable "$id" got invalid value true; ID cannot represent value: true',
		]);
	});

	test('suggests an enum value and an input field as graphql does', () => {
		const variables = z.object({ role: z.enum(['ADMIN', 'MEMBER']), person });
		expect(
			messagesOf(
				variables,
				{ role: 'Role!', person: 'Person!' },
				{ role: 'admn', person: { name: 'Ada', nmae: 'x' } },
			),
		).toEqual([
			'Variable "$role" got invalid value "admn"; Value "admn" does not exist in "Role" enum. Did you mean the enum value "ADMIN"?',
			'Variable "$person" got invalid value { name: "Ada", nmae: "x" }; Expected value of type "Person" not to include unknown field "nmae". Did you mean "name"? Found: { name: "Ada", nmae: "x" }.',
		]);
	});

	test('a OneOf input object takes exactly one non-null field', () => {
		const variables = z.object({
			by: z
				.object({})
				.loose()
				.refine(() => false),
		});
		const of = (by: unknown) => messagesOf(variables, { by: 'Pick!' }, { by });
		const oneOf =
			'Within OneOf Input Object type "Pick", exactly one field must be specified, and the value for that field must be non-null.';
		expect(of({})).toEqual([`Variable "$by" got invalid value {}; ${oneOf}`]);
		expect(of({ id: null })).toEqual([
			`Variable "$by" got invalid value { id: null } at "by.id"; ${oneOf}`,
		]);
	});

	test('empty when graphql takes every variable: an ID given an integer, a default', () => {
		const variables = z.object({ id: z.string(), first: z.int32().gte(1) });
		expect(
			messagesOf(variables, { id: 'ID!', first: 'Int! = 10' }, { id: 5 }),
		).toEqual([]);
	});

	test("locates each error at the variable's definition in the query sent", () => {
		const sent = { ids: ['a', true] };
		expect(
			coercionErrors(
				issuesOf(z.object({ ids: z.array(z.string()) }), sent),
				{
					query: 'query Q($ids: [ID!]!) { q(ids: $ids) }',
					operationName: 'Q',
					variables: sent,
				},
				{ variableTypes: { ids: '[ID!]!' }, inputTypes },
			),
		).toEqual([
			{
				message:
					'Variable "$ids" got invalid value true at "ids[1]"; ID cannot represent value: true',
				locations: [{ line: 1, column: 9 }],
			},
		]);
	});

	test('without a query that parses, no locations', () => {
		expect(
			coercionErrors(
				issuesOf(z.object({ ids: z.array(z.string()) }), {}),
				{ query: 'not graphql', operationName: 'Q', variables: {} },
				{ variableTypes: { ids: '[ID!]!' }, inputTypes },
			),
		).toEqual([
			{
				message: 'Variable "$ids" of required type "[ID!]!" was not provided.',
			},
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
