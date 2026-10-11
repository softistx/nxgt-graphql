import { describe, expect, test } from 'bun:test';
import { parse } from 'graphql';
import { cacheDocumentOf, variablesOf } from './selection';
import { EntityStore } from './store';
import { typeMatcher } from './type-match';
import type { CacheKeys, PossibleTypes } from './types';
import { writeResult } from './write';

interface Setup {
	variables?: Record<string, unknown>;
	possibleTypes?: PossibleTypes;
	keys?: CacheKeys;
	store?: EntityStore;
}

/** Writes `data` for `source` and returns the store's entities. */
function write(source: string, data: unknown, setup: Setup = {}) {
	const store = setup.store ?? new EntityStore();
	const document = cacheDocumentOf(parse(source));
	writeResult(
		{
			document,
			variables: variablesOf(document.operation, setup.variables),
			matches: typeMatcher(setup.possibleTypes),
			store,
			keys: setup.keys,
		},
		data,
	);
	return store;
}

describe('writeResult', () => {
	test('nested entities become references', () => {
		const store = write(
			'{ book(id: "1") { __typename id title author { __typename id name } } }',
			{
				book: {
					__typename: 'Book',
					id: '1',
					title: 'Dune',
					author: { __typename: 'Author', id: 'a', name: 'Herbert' },
				},
			},
		);
		expect(store.get('ROOT_QUERY')).toEqual({
			'book({"id":"1"})': { __ref: 'Book:1' },
		});
		expect(store.get('Book:1')).toEqual({
			__typename: 'Book',
			id: '1',
			title: 'Dune',
			author: { __ref: 'Author:a' },
		});
		expect(store.get('Author:a')).toEqual({
			__typename: 'Author',
			id: 'a',
			name: 'Herbert',
		});
	});

	test('an object with no identity is stored inside its parent, merged with what it held', () => {
		const store = write(
			'{ viewer { __typename id settings { __typename theme } } }',
			{
				viewer: {
					__typename: 'User',
					id: 'u',
					settings: { __typename: 'Settings', theme: 'dark' },
				},
			},
		);
		write(
			'{ viewer { __typename id settings { __typename lang } } }',
			{
				viewer: {
					__typename: 'User',
					id: 'u',
					settings: { __typename: 'Settings', lang: 'fr' },
				},
			},
			{ store },
		);
		expect(store.get('User:u')?.['settings']).toEqual({
			__typename: 'Settings',
			theme: 'dark',
			lang: 'fr',
		});
	});

	test('lists of entities, of scalars, and nulls', () => {
		const store = write('{ books { __typename id tags } empty }', {
			books: [
				{ __typename: 'Book', id: '1', tags: ['a', 'b'] },
				null,
				{ __typename: 'Book', id: '2', tags: [] },
			],
			empty: null,
		});
		expect(store.get('ROOT_QUERY')).toEqual({
			books: [{ __ref: 'Book:1' }, null, { __ref: 'Book:2' }],
			empty: null,
		});
		expect(store.get('Book:1')?.['tags']).toEqual(['a', 'b']);
	});

	test('arguments from variables, sorted; aliases resolved to field names', () => {
		const store = write(
			'query ($sort: Sort) { first: books(sort: $sort, first: 2) { __typename id t: title } }',
			{ first: [{ __typename: 'Book', id: '1', t: 'Dune' }] },
			{ variables: { sort: { desc: true, by: 'TITLE' } } },
		);
		expect(Object.keys(store.get('ROOT_QUERY') ?? {})).toEqual([
			'books({"first":2,"sort":{"by":"TITLE","desc":true}})',
		]);
		expect(store.get('Book:1')?.['title']).toBe('Dune');
	});

	test('fragments on an interface and a union, matched by possibleTypes', () => {
		const store = write(
			`{ search { __typename ...on Node { id } ...Media } }
			fragment Media on Media { ... on Book { pages } ... on Movie { minutes } }`,
			{
				search: [
					{ __typename: 'Book', id: '1', pages: 412 },
					{ __typename: 'Movie', id: '2', minutes: 155 },
				],
			},
			{ possibleTypes: { Node: ['Book', 'Movie'], Media: ['Book', 'Movie'] } },
		);
		expect(store.get('Book:1')).toEqual({
			__typename: 'Book',
			id: '1',
			pages: 412,
		});
		expect(store.get('Movie:2')).toEqual({
			__typename: 'Movie',
			id: '2',
			minutes: 155,
		});
	});

	test('a skipped field is not written', () => {
		const store = write(
			'query ($full: Boolean!) { book { __typename id title @include(if: $full) } }',
			{ book: { __typename: 'Book', id: '1' } },
			{ variables: { full: false } },
		);
		expect(store.get('Book:1')).toEqual({ __typename: 'Book', id: '1' });
	});

	test("a mutation's root fields are not kept, its entities are", () => {
		const store = write(
			'mutation ($password: String!) { signIn(password: $password) { __typename id name } }',
			{ signIn: { __typename: 'User', id: 'u', name: 'Ada' } },
			{ variables: { password: 'secret' } },
		);
		expect(store.get('ROOT_MUTATION')).toBeUndefined();
		expect(store.get('User:u')).toEqual({
			__typename: 'User',
			id: 'u',
			name: 'Ada',
		});
	});

	test('a JSON scalar is kept as it came, never normalized', () => {
		const payload = { __typename: 'Book', id: '9', nested: { a: 1 } };
		const store = write('{ settings }', { settings: payload });
		expect(store.get('ROOT_QUERY')?.['settings']).toEqual(payload);
		expect(store.get('Book:9')).toBeUndefined();
	});

	test('keys override the identity', () => {
		const store = write(
			'{ book { __typename isbn title } }',
			{ book: { __typename: 'Book', isbn: '978', title: 'Dune' } },
			{ keys: { Book: (book) => String(book['isbn']) } },
		);
		expect(store.get('ROOT_QUERY')).toEqual({ book: { __ref: 'Book:978' } });
	});

	test('data that is not an object throws', () => {
		expect(() => write('{ a }', null)).toThrow(
			"The cache stores an operation's data",
		);
	});
});
