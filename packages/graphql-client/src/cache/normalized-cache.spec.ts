import { describe, expect, mock, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { normalizedCache } from './normalized-cache';

type Book = { __typename: 'Book'; id: string; title: string };
const BookQuery = parse(
	'query Book($id: ID!) { book(id: $id) { id title } }',
) as TypedDocumentNode<{ book: Book | null }, { id: string }>;
const BooksQuery = parse(
	'query Books { books { id title } }',
) as TypedDocumentNode<{ books: Book[] }, Record<string, never>>;

const book = (id: string, title: string): Book => ({
	__typename: 'Book',
	id,
	title,
});

describe('normalizedCache', () => {
	test('read gives back what write stored, __typename included', () => {
		const cache = normalizedCache();
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		expect(cache.read(BookQuery, { id: '1' })).toEqual({
			book: book('1', 'Dune'),
		});
		expect(cache.read(BooksQuery)).toBeUndefined();
	});

	test('one entity, two results: a write through one is read through the other', () => {
		const cache = normalizedCache();
		cache.write(
			BooksQuery,
			{},
			{ books: [book('1', 'Dune'), book('2', 'Emma')] },
		);
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune Messiah') });
		expect(cache.read(BooksQuery)?.books.map((b) => b.title)).toEqual([
			'Dune Messiah',
			'Emma',
		]);
	});

	test('keys override the identity, and evict follows it', () => {
		const IsbnQuery = parse('{ book { isbn title } }') as TypedDocumentNode<
			{ book: { isbn: string; title: string } },
			Record<string, never>
		>;
		const cache = normalizedCache({ keys: { Book: (b) => String(b['isbn']) } });
		cache.write(
			IsbnQuery,
			{},
			{ book: { __typename: 'Book', isbn: '978', title: 'Dune' } as never },
		);
		expect(cache.evict({ __typename: 'Book', isbn: '978' })).toBe(true);
		expect(cache.read(IsbnQuery)).toBeUndefined();
	});

	test('evict by key or by ref; false when absent', () => {
		const cache = normalizedCache();
		cache.write(
			BooksQuery,
			{},
			{ books: [book('1', 'Dune'), book('2', 'Emma')] },
		);
		expect(cache.evict('Book:1')).toBe(true);
		expect(cache.evict({ __typename: 'Book', id: '2' })).toBe(true);
		expect(cache.evict('Book:1')).toBe(false);
		expect(cache.evict({ __typename: 'Book' })).toBe(false);
		expect(cache.read(BooksQuery)).toBeUndefined();
	});

	test('modify rewrites a field, and a list of references', () => {
		const cache = normalizedCache();
		cache.write(
			BooksQuery,
			{},
			{ books: [book('1', 'Dune'), book('2', 'Emma')] },
		);
		expect(
			cache.modify('Book:1', { title: (title) => `${title} (2nd ed.)` }),
		).toBe(true);
		cache.modify('ROOT_QUERY', {
			books: (refs) =>
				(refs as { __ref: string }[]).filter((ref) => ref.__ref !== 'Book:2'),
		});
		expect(cache.read(BooksQuery)).toEqual({
			books: [book('1', 'Dune (2nd ed.)')],
		});
		expect(
			cache.modify({ __typename: 'Book', id: '9' }, { title: () => 'x' }),
		).toBe(false);
	});

	test('reset empties it', () => {
		const cache = normalizedCache();
		cache.write(BooksQuery, {}, { books: [book('1', 'Dune')] });
		cache.reset();
		expect(cache.read(BooksQuery)).toBeUndefined();
	});

	test('a document without __typename is read and written as the client sends it', () => {
		const cache = normalizedCache();
		const Plain = parse('{ viewer { id } }') as TypedDocumentNode<
			{ viewer: { id: string } },
			Record<string, never>
		>;
		cache.write(
			Plain,
			{},
			{ viewer: { __typename: 'User', id: 'u' } as never },
		);
		expect(cache.read(Plain)).toEqual({
			viewer: { __typename: 'User', id: 'u' } as never,
		});
	});
});

describe('watch', () => {
	test('called once per write, however many fields it changed', () => {
		const cache = normalizedCache();
		cache.write(
			BooksQuery,
			{},
			{ books: [book('1', 'Dune'), book('2', 'Emma')] },
		);
		const callback = mock();
		cache.watch(BooksQuery, {}, callback);
		cache.write(
			BooksQuery,
			{},
			{ books: [book('1', 'Dune 2'), book('2', 'Emma 2')] },
		);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenLastCalledWith({
			books: [book('1', 'Dune 2'), book('2', 'Emma 2')],
		});
	});

	test('not called for another entity, another field, or a write that changes nothing', () => {
		const cache = normalizedCache();
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		const callback = mock();
		cache.watch(BookQuery, { id: '1' }, callback);
		cache.write(BookQuery, { id: '2' }, { book: book('2', 'Emma') });
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		cache.modify('Book:1', { pages: () => 10 });
		expect(callback).not.toHaveBeenCalled();
	});

	test('called by a mutation-like write through another document', () => {
		const cache = normalizedCache();
		cache.write(BooksQuery, {}, { books: [book('1', 'Dune')] });
		const callback = mock();
		cache.watch(BooksQuery, {}, callback);
		const Rename = parse(
			'mutation { rename { id title } }',
		) as TypedDocumentNode<{ rename: Book }, Record<string, never>>;
		cache.write(Rename, {}, { rename: book('1', 'Arrakis') });
		expect(callback).toHaveBeenCalledWith({ books: [book('1', 'Arrakis')] });
	});

	test('a miss is watched too: called when the result becomes whole', () => {
		const cache = normalizedCache();
		const callback = mock();
		cache.watch(BookQuery, { id: '1' }, callback);
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		expect(callback).toHaveBeenCalledWith({ book: book('1', 'Dune') });
	});

	test('evict, modify and reset call back; undefined once incomplete', () => {
		const cache = normalizedCache();
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		const callback = mock();
		cache.watch(BookQuery, { id: '1' }, callback);
		cache.modify('Book:1', { title: () => 'Dune!' });
		expect(callback).toHaveBeenLastCalledWith({ book: book('1', 'Dune!') });
		cache.evict('Book:1');
		expect(callback).toHaveBeenLastCalledWith(undefined);
		cache.reset();
		expect(callback).toHaveBeenCalledTimes(3);
	});

	test('the function returned stops it, even from within a callback of the same batch', () => {
		const cache = normalizedCache();
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		const second = mock();
		let stopSecond = () => {};
		const stopFirst = cache.watch(BookQuery, { id: '1' }, () => stopSecond());
		stopSecond = cache.watch(BookQuery, { id: '1' }, second);
		cache.modify('Book:1', { title: () => 'Emma' });
		expect(second).not.toHaveBeenCalled();
		stopFirst();
		const third = mock();
		cache.watch(BookQuery, { id: '1' }, third)();
		cache.modify('Book:1', { title: () => 'Persuasion' });
		expect(third).not.toHaveBeenCalled();
	});
});
