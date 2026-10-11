import { describe, expect, test } from 'bun:test';
import { parse } from 'graphql';
import { readResult } from './read';
import { cacheDocumentOf, variablesOf, type Walk } from './selection';
import { EntityStore } from './store';
import { typeMatcher } from './type-match';
import type { PossibleTypes } from './types';
import { writeResult } from './write';

function walkOf(
	source: string,
	variables: Record<string, unknown> = {},
	possibleTypes?: PossibleTypes,
): Walk {
	const document = cacheDocumentOf(parse(source));
	return {
		document,
		variables: variablesOf(document.operation, variables),
		matches: typeMatcher(possibleTypes),
	};
}

const write = (store: EntityStore, walk: Walk, data: unknown) =>
	writeResult({ ...walk, store, keys: undefined }, data);

const bookQuery =
	'query ($id: ID!) { book(id: $id) { __typename id title author { __typename id name } } }';
const dune = {
	book: {
		__typename: 'Book',
		id: '1',
		title: 'Dune',
		author: { __typename: 'Author', id: 'a', name: 'Herbert' },
	},
};

describe('readResult', () => {
	test('what was written reads back, through another document with fragments and aliases', () => {
		const store = new EntityStore();
		write(store, walkOf(bookQuery, { id: '1' }), dune);
		const other = walkOf(
			`query ($id: ID!) { novel: book(id: $id) { ...Title writer: author { name } } }
			fragment Title on Book { title }`,
			{ id: '1' },
		);
		expect(readResult(other, store).data).toEqual({
			novel: { title: 'Dune', writer: { name: 'Herbert' } },
		});
	});

	test('another argument, or a field never written, is a miss', () => {
		const store = new EntityStore();
		write(store, walkOf(bookQuery, { id: '1' }), dune);
		expect(
			readResult(walkOf(bookQuery, { id: '2' }), store).data,
		).toBeUndefined();
		const more = walkOf('{ book(id: "1") { title pages } }');
		expect(readResult(more, store).data).toBeUndefined();
	});

	test('a reference to an evicted entity is a miss', () => {
		const store = new EntityStore();
		write(store, walkOf(bookQuery, { id: '1' }), dune);
		store.evict('Author:a');
		expect(
			readResult(walkOf(bookQuery, { id: '1' }), store).data,
		).toBeUndefined();
	});

	test('a union read with possibleTypes takes the matching fragment only', () => {
		const possibleTypes = { Media: ['Book', 'Movie'] };
		const source =
			'{ search { __typename ... on Book { id title } ... on Movie { id director } } }';
		const store = new EntityStore();
		const data = {
			search: [
				{ __typename: 'Book', id: '1', title: 'Dune' },
				{ __typename: 'Movie', id: '2', director: 'Lynch' },
			],
		};
		write(store, walkOf(source, {}, possibleTypes), data);
		expect(readResult(walkOf(source, {}, possibleTypes), store).data).toEqual(
			data,
		);
	});

	test('without possibleTypes, a fragment on an interface is read when whole', () => {
		const store = new EntityStore();
		const source = '{ node { __typename id ... on Named { name } } }';
		write(store, walkOf(source), {
			node: { __typename: 'User', id: 'u', name: 'Ada' },
		});
		expect(readResult(walkOf(source), store).data).toEqual({
			node: { __typename: 'User', id: 'u', name: 'Ada' },
		});
		const other = walkOf('{ node { __typename id ... on Titled { title } } }');
		expect(readResult(other, store).data).toEqual({
			node: { __typename: 'User', id: 'u' },
		});
	});

	test('without possibleTypes, a list read twice is merged item by item', () => {
		const store = new EntityStore();
		const source =
			'{ box { __typename id items { a } ... on Thing { items { b } } } }';
		const data = {
			box: {
				__typename: 'Box',
				id: '1',
				items: [
					{ a: 1, b: 2 },
					{ a: 3, b: 4 },
				],
			},
		};
		write(store, walkOf(source), data);
		expect(readResult(walkOf(source), store).data).toEqual(data);
	});

	test('a skipped field is not needed; an included one is', () => {
		const store = new EntityStore();
		write(store, walkOf('{ book { __typename id } }'), {
			book: { __typename: 'Book', id: '1' },
		});
		const source =
			'query ($full: Boolean!) { book { __typename id title @include(if: $full) } }';
		expect(readResult(walkOf(source, { full: false }), store).data).toEqual({
			book: { __typename: 'Book', id: '1' },
		});
		expect(
			readResult(walkOf(source, { full: true }), store).data,
		).toBeUndefined();
	});

	test('a variable left out reads its default', () => {
		const store = new EntityStore();
		write(store, walkOf('{ items(first: 2) }'), { items: [1, 2] });
		const source = 'query ($n: Int = 2) { items(first: $n) }';
		expect(readResult(walkOf(source), store).data).toEqual({ items: [1, 2] });
	});

	test('the result is a fresh object: changing it leaves the cache as it was', () => {
		const store = new EntityStore();
		const walk = walkOf('{ book { __typename id tags meta } }');
		write(store, walk, {
			book: { __typename: 'Book', id: '1', tags: ['a'], meta: { x: 1 } },
		});
		const first = readResult(walk, store).data as {
			book: { tags: string[]; meta: { x: number } };
		};
		first.book.tags.push('b');
		first.book.meta.x = 2;
		expect(readResult(walk, store).data).toEqual({
			book: { __typename: 'Book', id: '1', tags: ['a'], meta: { x: 1 } },
		});
	});

	test('an empty store is a miss that still depends on the root', () => {
		const { data, deps } = readResult(walkOf('{ a }'), new EntityStore());
		expect(data).toBeUndefined();
		const changes = new EntityStore();
		changes.merge('ROOT_QUERY', { a: 1 });
		expect(deps.touchedBy(changes.takeChanges())).toBe(true);
	});
});
