import { describe, expect, test } from 'bun:test';
import { identify } from './identity';

describe('identify', () => {
	test('__typename and id, else _id', () => {
		expect(identify({ __typename: 'Book', id: '1' }, undefined)).toBe('Book:1');
		expect(identify({ __typename: 'Book', id: 7 }, undefined)).toBe('Book:7');
		expect(identify({ __typename: 'Book', _id: 'a' }, undefined)).toBe(
			'Book:a',
		);
	});

	test('no __typename, or no id, is no identity', () => {
		expect(identify({ id: '1' }, undefined)).toBeUndefined();
		expect(
			identify({ __typename: 'Price', amount: 1 }, undefined),
		).toBeUndefined();
		expect(
			identify({ __typename: 'Book', id: { nested: 1 } }, undefined),
		).toBeUndefined();
	});

	test('keys gives a type its identity, or none with null', () => {
		const keys = {
			Book: (book: Readonly<Record<string, unknown>>) => String(book['isbn']),
			Session: () => null,
		};
		expect(identify({ __typename: 'Book', id: '1', isbn: 'x' }, keys)).toBe(
			'Book:x',
		);
		expect(identify({ __typename: 'Session', id: '1' }, keys)).toBeUndefined();
		expect(identify({ __typename: 'Author', id: '1' }, keys)).toBe('Author:1');
	});

	test('a typename named like an Object.prototype key is not a keys entry', () => {
		expect(identify({ __typename: 'constructor', id: '1' }, {})).toBe(
			'constructor:1',
		);
	});
});
