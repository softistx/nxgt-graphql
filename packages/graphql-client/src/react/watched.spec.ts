import '../../test/dom';
import { describe, expect, test } from 'bun:test';
import { cleanup, renderHook } from '@testing-library/react/pure';
import { useLayoutEffect } from 'react';
import { useDom } from '../../test/dom';
import { BookCard, BookQuery, book, url, withClient } from '../../test/react';
import { normalizedCache } from '../cache/normalized-cache';
import { createGraphQLClient } from '../client';
import { useFragment } from './use-fragment';

useDom(cleanup);

describe('useWatched', () => {
	test('a write between the first read and the subscribe is shown', () => {
		const cache = normalizedCache();
		const client = createGraphQLClient({
			url,
			fetch: async () => Response.json({ data: {} }),
			cache,
		});
		cache.write(BookQuery, { id: '1' }, { book: book('Dune') });
		const seen: (string | undefined)[] = [];
		const { result } = renderHook(
			() => {
				const card = useFragment(BookCard, 'Book:1');
				seen.push(card?.title);
				// A layout effect runs after the render's read, before the
				// passive effect that subscribes: the watch is not there yet.
				useLayoutEffect(() => {
					cache.write(BookQuery, { id: '1' }, { book: book('Dune Messiah') });
				}, []);
				return card;
			},
			{ wrapper: withClient(client) },
		);
		expect(seen[0]).toBe('Dune');
		expect(result.current?.title).toBe('Dune Messiah');
	});
});
