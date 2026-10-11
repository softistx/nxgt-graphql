import '../../test/dom';
import { describe, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react/pure';
import { useDom } from '../../test/dom';
import { BookCard, BookQuery, book, url, withClient } from '../../test/react';
import { normalizedCache } from '../cache/normalized-cache';
import { createGraphQLClient } from '../client';
import { noFragmentCache, useFragment } from './use-fragment';

useDom(cleanup);

function setup() {
	let requests = 0;
	const client = createGraphQLClient({
		url,
		fetch: async () => {
			requests++;
			return Response.json({ data: {} });
		},
		cache: normalizedCache(),
	});
	const cache = client.cache as NonNullable<typeof client.cache>;
	return { client, cache, requests: () => requests };
}

describe('useFragment', () => {
	test('reads the entity, and renders again when a write changes it', () => {
		const { client, cache, requests } = setup();
		cache.write(BookQuery, { id: '1' }, { book: book('Dune') });
		const { result } = renderHook(
			() => useFragment(BookCard, { __typename: 'Book', id: '1' }),
			{ wrapper: withClient(client) },
		);
		expect(result.current).toEqual(book('Dune'));
		act(() => {
			cache.write(BookQuery, { id: '1' }, { book: book('Dune Messiah') });
		});
		expect(result.current).toEqual(book('Dune Messiah'));
		expect(requests()).toBe(0);
	});

	test('undefined while the entity is missing, then its fields once written', () => {
		const { client, cache } = setup();
		const { result } = renderHook(() => useFragment(BookCard, 'Book:1'), {
			wrapper: withClient(client),
		});
		expect(result.current).toBeUndefined();
		act(() => {
			cache.write(BookQuery, { id: '1' }, { book: book('Dune') });
		});
		expect(result.current).toEqual(book('Dune'));
		act(() => {
			cache.evict('Book:1');
		});
		expect(result.current).toBeUndefined();
	});

	test('a null ref reads nothing', () => {
		const { client } = setup();
		const { result } = renderHook(() => useFragment(BookCard, null), {
			wrapper: withClient(client),
		});
		expect(result.current).toBeUndefined();
	});

	test('the same ref in a new object keeps the same data object', () => {
		const { client, cache } = setup();
		cache.write(BookQuery, { id: '1' }, { book: book('Dune') });
		const { result, rerender } = renderHook(
			() => useFragment(BookCard, { __typename: 'Book', id: '1' }),
			{ wrapper: withClient(client) },
		);
		const first = result.current;
		rerender();
		expect(result.current).toBe(first);
	});

	test('a client without a cache throws, naming the fix', () => {
		const client = createGraphQLClient({
			url,
			fetch: async () => Response.json({}),
		});
		const consoleError = console.error;
		console.error = () => {};
		try {
			expect(() =>
				renderHook(() => useFragment(BookCard, 'Book:1'), {
					wrapper: withClient(client),
				}),
			).toThrow(noFragmentCache);
		} finally {
			console.error = consoleError;
		}
	});
});
