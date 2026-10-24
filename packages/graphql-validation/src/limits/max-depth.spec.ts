import { describe, expect, test } from 'bun:test';
import { getIntrospectionQuery, Kind } from 'graphql';

/** Levels of the standard introspection query, measured. */
const INTROSPECTION_DEPTH = 15;

import { check, cycleQuery, limitOf } from '../../test/limits';
import { maxDepth } from './max-depth';

describe('maxDepth', () => {
	test('refuses the issue query: it is 9 levels deep', () => {
		const [error, ...rest] = check(cycleQuery, [maxDepth({ depth: 8 })]);
		expect(rest).toHaveLength(0);
		expect(error?.message).toBe(
			'Operation is 9 levels deep, more than the 8 allowed',
		);
		expect(limitOf(error)).toEqual({
			code: 'QUERY_TOO_DEEP',
			depth: 9,
			limit: 8,
		});
		expect(error?.nodes).toHaveLength(1);
		expect(error?.nodes?.[0]?.kind).toBe(Kind.OPERATION_DEFINITION);
	});

	test('accepts a query exactly at the limit', () => {
		expect(check(cycleQuery, [maxDepth({ depth: 9 })])).toEqual([]);
	});

	test('names the operation', () => {
		const [error] = check('query Deep { folder(id: "1") { items { id } } }', [
			maxDepth({ depth: 2 }),
		]);
		expect(error?.message).toBe(
			'Operation "Deep" is 3 levels deep, more than the 2 allowed',
		);
	});

	test('a top-level field is depth 1', () => {
		expect(
			check('{ folder(id: "1") { id } }', [maxDepth({ depth: 2 })]),
		).toEqual([]);
		expect(
			check('{ folder(id: "1") { id } }', [maxDepth({ depth: 1 })]),
		).toHaveLength(1);
	});

	test('follows named fragments', () => {
		const source = `
			query { folder(id: "1") { ...F } }
			fragment F on Folder { items { folder { id } } }
		`;
		const [error] = check(source, [maxDepth({ depth: 3 })]);
		expect(limitOf(error).depth).toBe(4);
		expect(check(source, [maxDepth({ depth: 4 })])).toEqual([]);
	});

	test('inline fragments add no depth', () => {
		const source = `{ folder(id: "1") { ... on Folder { ... { id } } } }`;
		expect(check(source, [maxDepth({ depth: 2 })])).toEqual([]);
		expect(check(source, [maxDepth({ depth: 1 })])).toHaveLength(1);
	});

	test('a fragment used twice is measured once and counted at each place', () => {
		const source = `
			query { folder(id: "1") { items { folder { ...F } } } }
			fragment F on Folder { items { id } }
		`;
		expect(check(source, [maxDepth({ depth: 5 })])).toEqual([]);
		expect(limitOf(check(source, [maxDepth({ depth: 4 })])[0]).depth).toBe(5);
	});

	test('a fragment cycle does not loop', () => {
		const source = `
			query { folder(id: "1") { ...A } }
			fragment A on Folder { items { folder { ...B } } }
			fragment B on Folder { items { folder { ...A } } }
		`;
		const errors = check(source, [maxDepth({ depth: 100 })]);
		expect(errors.every((e) => limitOf(e).code !== 'QUERY_TOO_DEEP')).toBe(
			true,
		);
	});

	test('__typename does not count', () => {
		expect(
			check('{ folder(id: "1") { __typename id } }', [maxDepth({ depth: 2 })]),
		).toEqual([]);
		expect(check('{ __typename }', [maxDepth({ depth: 1 })])).toEqual([]);
	});

	test('introspection counts like any field', () => {
		const source = '{ __schema { types { fields { type { name } } } } }';
		expect(limitOf(check(source, [maxDepth({ depth: 4 })])[0]).depth).toBe(5);
		expect(
			check('{ __type(name: "Folder") { fields { name } } }', [
				maxDepth({ depth: 3 }),
			]),
		).toEqual([]);
	});

	test('the standard introspection query is refused by a limit of 8', () => {
		const [error] = check(getIntrospectionQuery(), [maxDepth({ depth: 8 })]);
		expect(limitOf(error).code).toBe('QUERY_TOO_DEEP');
		expect(limitOf(error).depth).toBe(INTROSPECTION_DEPTH);
	});

	test('ignoreIntrospection lets introspection through', () => {
		const rule = maxDepth({ depth: 8, ignoreIntrospection: true });
		expect(check(getIntrospectionQuery(), [rule])).toEqual([]);
		expect(
			check(
				'{ __schema { types { name } } folder(id: "1") { items { id } } }',
				[maxDepth({ depth: 2, ignoreIntrospection: true })],
			),
		).toHaveLength(1);
	});

	test('aliased introspection cannot hide a deep selection', () => {
		const source = `{ a: __schema { types { fields { type { fields { type { name } } } } } } }`;
		expect(check(source, [maxDepth({ depth: 4 })])).toHaveLength(1);
	});

	test('reports one error per operation', () => {
		const source = `
			query A { folder(id: "1") { items { id } } }
			query B { folder(id: "1") { id } }
			query C { folder(id: "1") { items { folder { id } } } }
		`;
		const errors = check(source, [maxDepth({ depth: 2 })]);
		expect(errors.map((e) => e.message)).toEqual([
			'Operation "A" is 3 levels deep, more than the 2 allowed',
			'Operation "C" is 4 levels deep, more than the 2 allowed',
		]);
	});

	test('refuses an unusable option', () => {
		expect(() => maxDepth({ depth: 0 })).toThrow(RangeError);
		expect(() => maxDepth({ depth: 1.5 })).toThrow(RangeError);
	});
});
