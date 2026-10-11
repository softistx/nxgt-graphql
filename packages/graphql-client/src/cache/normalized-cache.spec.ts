import { describe, expect, mock, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { stubReportError } from '../../test/report-error';
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
		// Already incomplete: a reset leaves its result as it was.
		cache.reset();
		expect(callback).toHaveBeenCalledTimes(2);
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		cache.reset();
		expect(callback).toHaveBeenCalledTimes(4);
		expect(callback).toHaveBeenLastCalledWith(undefined);
	});

	test('not called when the fields it reads came out equal', () => {
		const Theme = parse('{ settings { theme } }') as TypedDocumentNode<
			{ settings: { theme: string } },
			Record<string, never>
		>;
		const Lang = parse('{ settings { lang } }') as TypedDocumentNode<
			{ settings: { lang: string } },
			Record<string, never>
		>;
		const cache = normalizedCache();
		cache.write(Theme, {
			settings: { __typename: 'Settings', theme: 'dark' } as never,
		});
		const callback = mock();
		cache.watch(Theme, callback);
		cache.write(Lang, {
			settings: { __typename: 'Settings', lang: 'fr' } as never,
		});
		expect(callback).not.toHaveBeenCalled();
		cache.write(Theme, {
			settings: { __typename: 'Settings', theme: 'light' } as never,
		});
		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('a callback that changes its data does not change what the next read is compared with', () => {
		const cache = normalizedCache();
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		const seen: string[] = [];
		cache.watch(BookQuery, { id: '1' }, (data) => {
			if (!data?.book) return;
			seen.push(data.book.title);
			data.book.title = 'changed by the callback';
		});
		cache.modify('Book:1', { title: () => 'Emma' });
		cache.modify('Book:1', { title: () => 'changed by the callback' });
		expect(seen).toEqual(['Emma', 'changed by the callback']);
	});

	test('a callback that throws is reported; the other watches still run and the write stands', () => {
		const reported = stubReportError();
		try {
			const cache = normalizedCache();
			cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
			const failure = new Error('render failed');
			cache.watch(BookQuery, { id: '1' }, () => {
				throw failure;
			});
			const second = mock();
			cache.watch(BookQuery, { id: '1' }, second);
			cache.write(BookQuery, { id: '1' }, { book: book('1', 'Emma') });
			expect(second).toHaveBeenCalledWith({ book: book('1', 'Emma') });
			expect(reported.errors).toEqual([failure]);
			expect(cache.read(BookQuery, { id: '1' })?.book?.title).toBe('Emma');
		} finally {
			reported.restore();
		}
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

describe('write', () => {
	test('variables may be left out when the document requires none', () => {
		const cache = normalizedCache();
		cache.write(BooksQuery, { books: [book('1', 'Dune')] });
		cache.write(BooksQuery, undefined, { books: [book('1', 'Emma')] });
		expect(cache.read(BooksQuery)).toEqual({ books: [book('1', 'Emma')] });
	});

	test('all or nothing: a keys function that throws halfway changes nothing and calls no watch', () => {
		const cache = normalizedCache({
			keys: {
				Book: (b) => {
					if (b['id'] === '2') throw new Error('no identity');
					return String(b['id']);
				},
			},
		});
		cache.write(BooksQuery, { books: [book('1', 'Dune')] });
		const callback = mock();
		cache.watch(BooksQuery, callback);
		expect(() =>
			cache.write(BooksQuery, {
				books: [book('1', 'Dune Messiah'), book('2', 'Emma')],
			}),
		).toThrow('no identity');
		expect(cache.read(BooksQuery)).toEqual({ books: [book('1', 'Dune')] });
		expect(callback).not.toHaveBeenCalled();
	});

	test('an entity met twice in one result is merged, and its watch called once', () => {
		const Pair = parse(
			'{ first: book(id: "1") { id title } second: book(id: "1") { id pages } }',
		) as TypedDocumentNode<
			{
				first: Book;
				second: { __typename: 'Book'; id: string; pages: number };
			},
			Record<string, never>
		>;
		const cache = normalizedCache();
		cache.write(BookQuery, { id: '1' }, { book: book('1', 'Dune') });
		const callback = mock();
		cache.watch(BookQuery, { id: '1' }, callback);
		cache.write(Pair, {
			first: book('1', 'Emma'),
			second: { __typename: 'Book', id: '1', pages: 412 },
		});
		expect(callback).toHaveBeenCalledTimes(1);
		expect(cache.read(BookQuery, { id: '1' })).toEqual({
			book: book('1', 'Emma'),
		});
	});
});

describe('readFragment and watchFragment', () => {
	const BookCard = parse(
		'fragment BookCard on Book { title author { ...AuthorName } } fragment AuthorName on Author { name }',
	) as TypedDocumentNode<{ title: string; author: { name: string } }, unknown>;
	const BookWithAuthor = parse(
		'query { book(id: "1") { id title author { id name } } }',
	) as TypedDocumentNode<{ book: unknown }, Record<string, never>>;
	const dune = {
		book: {
			__typename: 'Book',
			id: '1',
			title: 'Dune',
			author: { __typename: 'Author', id: 'a', name: 'Herbert' },
		},
	};

	test('reads one entity through a fragment document, its spreads followed', () => {
		const cache = normalizedCache();
		cache.write(BookWithAuthor, dune);
		const expected = {
			__typename: 'Book',
			title: 'Dune',
			author: { __typename: 'Author', name: 'Herbert' },
		};
		expect(cache.readFragment(BookCard, 'Book:1')).toEqual(expected);
		expect(
			cache.readFragment(BookCard, { __typename: 'Book', id: '1' }),
		).toEqual(expected);
		expect(
			cache.readFragment(BookCard, 'Author:a', { fragmentName: 'AuthorName' }),
		).toEqual({ __typename: 'Author', name: 'Herbert' } as never);
	});

	test('undefined for an entity not held, a field missing, or a ref with no identity', () => {
		const cache = normalizedCache();
		cache.write(BookWithAuthor, dune);
		expect(cache.readFragment(BookCard, 'Book:2')).toBeUndefined();
		const Pages = parse(
			'fragment Pages on Book { pages }',
		) as TypedDocumentNode<{ pages: number }, unknown>;
		expect(cache.readFragment(Pages, 'Book:1')).toBeUndefined();
		expect(
			cache.readFragment(BookCard, { __typename: 'Book' }),
		).toBeUndefined();
	});

	test('a TypedDocumentString fragment, and its variables', () => {
		const cache = normalizedCache();
		cache.write(
			parse('{ book(id: "1") { id cover(size: 2) } }') as TypedDocumentNode<
				unknown,
				Record<string, never>
			>,
			{ book: { __typename: 'Book', id: '1', cover: 'c2.png' } },
		);
		const Cover = new String(
			'fragment Cover on Book { cover(size: $size) }',
		) as unknown as TypedDocumentNode<{ cover: string }, unknown>;
		expect(
			cache.readFragment(Cover, 'Book:1', { variables: { size: 2 } }),
		).toEqual({ __typename: 'Book', cover: 'c2.png' } as never);
	});

	test('a document with no fragment, or not the one named, is refused', () => {
		const cache = normalizedCache();
		expect(() => cache.readFragment(BooksQuery, 'Book:1')).toThrow(
			'The document holds no fragment',
		);
		expect(() =>
			cache.readFragment(BookCard, 'Book:1', { fragmentName: 'Nope' }),
		).toThrow('The document has no fragment Nope');
	});

	test('watchFragment calls back when the entity’s fields it reads change, not for another', () => {
		const cache = normalizedCache();
		cache.write(BookWithAuthor, dune);
		const callback = mock();
		const stop = cache.watchFragment(BookCard, 'Book:1', callback);
		cache.modify('Book:1', { pages: () => 412 });
		cache.write(BookQuery, { id: '2' }, { book: book('2', 'Emma') });
		expect(callback).not.toHaveBeenCalled();
		cache.modify('Author:a', { name: () => 'Frank Herbert' });
		expect(callback).toHaveBeenLastCalledWith({
			__typename: 'Book',
			title: 'Dune',
			author: { __typename: 'Author', name: 'Frank Herbert' },
		});
		cache.evict('Book:1');
		expect(callback).toHaveBeenLastCalledWith(undefined);
		stop();
		cache.write(BookWithAuthor, dune);
		expect(callback).toHaveBeenCalledTimes(2);
	});
});
