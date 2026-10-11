import { describe, expect, test } from 'bun:test';
import { assertJson, equal, isPlainObject } from './values';

describe('isPlainObject', () => {
	test('an object whose prototype is Object.prototype or null, nothing else', () => {
		expect(isPlainObject({ a: 1 })).toBe(true);
		expect(isPlainObject(Object.create(null))).toBe(true);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject(new Date(0))).toBe(false);
		expect(isPlainObject(new Map())).toBe(false);
		expect(isPlainObject(new (class Book {})())).toBe(false);
	});
});

describe('equal', () => {
	test('arrays and plain objects by content', () => {
		expect(equal({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
		const bare = Object.assign(Object.create(null), { a: 1 });
		expect(equal(bare, { a: 1 })).toBe(true);
		expect(equal({ a: 1 }, { a: 1, b: undefined })).toBe(false);
	});

	test('anything else by Object.is: two Dates of the same time differ', () => {
		const date = new Date(0);
		expect(equal(date, date)).toBe(true);
		expect(equal(new Date(0), new Date(0))).toBe(false);
		expect(equal(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
	});
});

describe('assertJson', () => {
	test('accepts null, booleans, numbers, strings, plain objects and arrays', () => {
		expect(() =>
			assertJson({ a: [null, true, 1, 'x', { b: [] }] }, 'f'),
		).not.toThrow();
	});

	test('refuses anything else with a TypeError naming the field and the kind', () => {
		expect(() => assertJson(new Date(0), 'published')).toThrow(
			new TypeError('The cache holds JSON: field published holds a Date'),
		);
		expect(() => assertJson({ a: new Map() }, 'f')).toThrow(
			'The cache holds JSON: field f holds a Map',
		);
		expect(() => assertJson([undefined], 'f')).toThrow(
			'The cache holds JSON: field f holds undefined',
		);
		expect(() => assertJson(1n, 'f')).toThrow(
			'The cache holds JSON: field f holds a bigint',
		);
		expect(() => assertJson(() => 1, 'f')).toThrow(
			'The cache holds JSON: field f holds a function',
		);
	});
});
