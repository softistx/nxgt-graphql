import { describe, expect, test } from 'bun:test';
import { buildSchema, getIntrospectionQuery, parse, validate } from 'graphql';
import { check, limitOf } from '../../test/limits';
import { maxDepth } from './max-depth';
import { maxFields } from './max-fields';
import { maxListCost } from './max-list-cost';

/** Fields the standard introspection query selects, measured. */
const INTROSPECTION_FIELDS = 220;

const schema = buildSchema(/* GraphQL */ `
	type Item {
		id: ID!
		name: String
	}
	type Folder {
		id: ID!
		items(first: Int = 10): [Item!]!
	}
	union Thing = Item | Folder
	type Query {
		item(id: ID!): Item
		folder(id: ID!): Folder
		thing: Thing
	}
`);

const run = (source: string, limit: number, ignoreIntrospection = false) =>
	check(source, [maxFields({ limit, ignoreIntrospection })], schema);

const aliases = (count: number, selection: string) =>
	Array.from({ length: count }, (_, i) => `a${i}: ${selection}`).join(' ');

describe('maxFields', () => {
	test('refuses the issue query: 2000 aliases of item { id } select 4000 fields', () => {
		const [error, ...rest] = run(
			`{ ${aliases(2000, 'item(id: "1") { id }')} }`,
			500,
		);
		expect(rest).toHaveLength(0);
		expect(error?.message).toBe(
			'Operation selects 4000 fields, more than the 500 allowed',
		);
		expect(limitOf(error)).toEqual({
			code: 'QUERY_TOO_WIDE',
			fields: 4000,
			limit: 500,
		});
		expect(error?.nodes).toHaveLength(1);
	});

	test('refuses 3000 aliases of __typename', () => {
		const [error] = run(`{ ${aliases(3000, '__typename')} }`, 500);
		expect(limitOf(error).fields).toBe(3000);
	});

	test('accepts a query exactly at the limit, refuses one over', () => {
		const source = `{ ${aliases(10, 'item(id: "1") { id }')} }`;
		expect(run(source, 20)).toEqual([]);
		expect(limitOf(run(source, 19)[0]).fields).toBe(20);
	});

	test('names the operation', () => {
		const [error] = run('query Wide { item(id: "1") { id name } }', 2);
		expect(error?.message).toBe(
			'Operation "Wide" selects 3 fields, more than the 2 allowed',
		);
	});

	test('a named fragment counts at each spread', () => {
		const source = `
			{ a: item(id: "1") { ...F } b: item(id: "2") { ...F } }
			fragment F on Item { id name }
		`;
		expect(run(source, 6)).toEqual([]);
		expect(limitOf(run(source, 5)[0]).fields).toBe(6);
	});

	test('a fragment used 1000 times inside a fragment used 1000 times is fast and clamped', () => {
		const inner = `fragment Inner on Item { id name }`;
		const middle = `fragment Middle on Item { ${'...Inner '.repeat(1000)} }`;
		const outer = `fragment Outer on Item { ${'...Middle '.repeat(1000)} }`;
		let source = `{ item(id: "1") { ...Outer } } ${outer} ${middle} ${inner}`;
		const started = performance.now();
		const [error] = run(source, 500);
		expect(performance.now() - started).toBeLessThan(500);
		// 1 + 1000 * 1000 * 2 fields.
		expect(limitOf(error).fields).toBe(2_000_001);
		source = `{ item(id: "1") { ...L0 } } ${Array.from(
			{ length: 40 },
			(_, i) =>
				`fragment L${i} on Item { ${'...L'.concat(String(i + 1), ' ').repeat(50)} }`,
		).join(' ')} fragment L40 on Item { id }`;
		const [huge] = run(source, 500);
		expect(limitOf(huge).fields).toBe(Number.MAX_SAFE_INTEGER);
	});

	test('the work is linear: each fragment is walked once', () => {
		const levels = 300;
		const source = `{ item(id: "1") { ...F0 } } ${Array.from(
			{ length: levels },
			(_, i) => `fragment F${i} on Item { ...F${i + 1} ...F${i + 1} }`,
		).join(' ')} fragment F${levels} on Item { id }`;
		const started = performance.now();
		const [error] = run(source, 500);
		expect(performance.now() - started).toBeLessThan(500);
		expect(limitOf(error).fields).toBe(Number.MAX_SAFE_INTEGER);
	});

	test('a fragment cycle does not loop', () => {
		const source = `
			{ item(id: "1") { ...A } }
			fragment A on Item { id ...B }
			fragment B on Item { name ...A }
		`;
		const errors = run(source, 100);
		expect(errors.every((e) => limitOf(e).code !== 'QUERY_TOO_WIDE')).toBe(
			true,
		);
	});

	test('@skip and @include are not evaluated', () => {
		const source = '{ item(id: "1") { id @skip(if: true) } }';
		expect(limitOf(run(source, 1)[0]).fields).toBe(2);
		expect(run(source, 2)).toEqual([]);
	});

	test('a fragment cycle counts 0 where it closes', () => {
		const source = `
			{ item(id: "1") { ...A } }
			fragment A on Item { id ...B }
			fragment B on Item { name ...A }
		`;
		const [error] = validate(schema, parse(source), [maxFields({ limit: 1 })]);
		expect(limitOf(error).fields).toBe(3);
	});

	test('inline fragments on a union count every branch', () => {
		const source = `{ thing { ... on Item { id name } ... on Folder { id } __typename } }`;
		expect(run(source, 5)).toEqual([]);
		expect(limitOf(run(source, 4)[0]).fields).toBe(5);
	});

	test('introspection counts unless ignored', () => {
		const source = '{ __schema { types { name } } }';
		expect(limitOf(run(source, 2)[0]).fields).toBe(3);
		expect(run(source, 2, true)).toEqual([]);
		expect(
			run('{ __type(name: "Item") { name } item(id: "1") { id } }', 2, true),
		).toEqual([]);
	});

	test('the standard introspection query selects a known number of fields', () => {
		expect(limitOf(run(getIntrospectionQuery(), 10)[0]).fields).toBe(
			INTROSPECTION_FIELDS,
		);
		expect(run(getIntrospectionQuery(), 10, true)).toEqual([]);
	});

	test('reports one error per operation', () => {
		const source = `
			query A { item(id: "1") { id name } }
			query B { item(id: "1") { id } }
			query C { __typename }
		`;
		const errors = check(source, [maxFields({ limit: 2 })], schema);
		expect(errors.map((e) => e.message)).toEqual([
			'Operation "A" selects 3 fields, more than the 2 allowed',
		]);
		expect(run('{ item(id: "1") { id name } }', 2)[0]?.message).toBe(
			'Operation selects 3 fields, more than the 2 allowed',
		);
	});

	test('refuses an unusable option', () => {
		expect(() => maxFields({ limit: 0 })).toThrow(RangeError);
		expect(() => maxFields({ limit: 1.5 })).toThrow(RangeError);
		expect(() => maxFields({ limit: Number.MAX_SAFE_INTEGER })).toThrow(
			RangeError,
		);
		expect(() => maxFields({ limit: 1 })).not.toThrow();
	});

	test('sits beside maxDepth and maxListCost in one validate', () => {
		const rules = [
			maxDepth({ depth: 2 }),
			maxListCost({ budget: 1000, defaultFirst: 10 }),
			maxFields({ limit: 3 }),
		];
		const codes = (source: string) =>
			check(source, rules, schema).map((e) => limitOf(e).code);
		expect(codes('{ item(id: "1") { id } }')).toEqual([]);
		expect(codes('{ folder(id: "1") { items { id } } }')).toEqual([
			'QUERY_TOO_DEEP',
		]);
		expect(
			codes('{ a: item(id: "1") { id } b: item(id: "1") { id } }'),
		).toEqual(['QUERY_TOO_WIDE']);
		expect(
			codes(
				'{ a: folder(id: "1") { items { id } } b: folder(id: "1") { items { id } } }',
			),
		).toEqual(['QUERY_TOO_DEEP', 'QUERY_TOO_WIDE']);
	});
});
