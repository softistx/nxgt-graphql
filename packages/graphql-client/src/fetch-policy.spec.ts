import { describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { normalizedCache } from './cache/normalized-cache';
import { createGraphQLClient } from './client';
import { CacheMissError } from './errors';
import { noCache } from './fetch-policy';
import type { QueryOptions } from './options';

type Book = { __typename: 'Book'; id: string; title: string };
const BookQuery = parse(
	'query Book($id: ID!) { book(id: $id) { id title } }',
) as TypedDocumentNode<{ book: Book }, { id: string }>;
const BookPagesQuery = parse(
	'query BookPages($id: ID!) { book(id: $id) { id title pages } }',
) as TypedDocumentNode<{ book: Book & { pages: number } }, { id: string }>;
const RenameMutation = parse(
	'mutation Rename($id: ID!, $title: String!) { rename(id: $id, title: $title) { id title } }',
) as TypedDocumentNode<{ rename: Book }, { id: string; title: string }>;

const book = (title: string, more: Record<string, unknown> = {}) => ({
	__typename: 'Book' as const,
	id: '1',
	title,
	...more,
});

/** A fetch answering `data` for each call, counting them. */
function server(answer: (body: { operationName: string }) => unknown) {
	const calls: string[] = [];
	const fetch = async (request: Request) => {
		const body = (await request.json()) as { operationName: string };
		calls.push(body.operationName);
		return Response.json({ data: answer(body) });
	};
	return { fetch, calls };
}

const url = 'https://api.test/graphql';

function setup(
	answer: (body: { operationName: string }) => unknown,
	cache = normalizedCache(),
) {
	const api = server(answer);
	const client = createGraphQLClient({ url, fetch: api.fetch, cache });
	return {
		api,
		client,
		cache: client.cache as NonNullable<typeof client.cache>,
	};
}

describe('fetchPolicy with a cache', () => {
	test('cache-first (the default) answers from the cache without a request', async () => {
		const { api, client } = setup(() => ({ book: book('Dune') }));
		await client.query(BookQuery, { id: '1' });
		expect(await client.query(BookQuery, { id: '1' })).toEqual({
			book: book('Dune'),
		});
		expect(api.calls).toEqual(['Book']);
	});

	test('cache-first with a field missing goes to the network, then writes', async () => {
		const { api, client } = setup((body) =>
			body.operationName === 'Book'
				? { book: book('Dune') }
				: { book: book('Dune', { pages: 412 }) },
		);
		await client.query(BookQuery, { id: '1' });
		await client.query(BookPagesQuery, { id: '1' });
		await client.query(BookPagesQuery, { id: '1' });
		expect(api.calls).toEqual(['Book', 'BookPages']);
	});

	test('network-only always asks, writes, and returns the network’s own data', async () => {
		let title = 'Dune';
		const { api, client, cache } = setup(() => ({ book: book(title) }));
		await client.query(BookQuery, { id: '1' });
		title = 'Dune Messiah';
		const written: unknown[] = [];
		const write = cache.write.bind(cache);
		cache.write = ((document, ...args) => {
			written.push(args.at(-1));
			write(document, ...args);
		}) as typeof cache.write;
		const data = await client.query(
			BookQuery,
			{ id: '1' },
			{ fetchPolicy: 'network-only' },
		);
		expect(data).toEqual({ book: book('Dune Messiah') });
		expect(written[0]).toBe(data);
		expect(api.calls).toHaveLength(2);
		// The caller's object is not the cache's: changing it changes nothing there.
		data.book.title = 'changed by the caller';
		expect(cache.read(BookQuery, { id: '1' })?.book.title).toBe('Dune Messiah');
	});

	test('no-cache asks and leaves the cache as it was', async () => {
		const { client, cache } = setup(() => ({ book: book('Dune') }));
		await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'no-cache' });
		expect(cache.read(BookQuery, { id: '1' })).toBeUndefined();
	});

	test('cache-only answers from the cache, or throws CacheMissError without a request', async () => {
		const { api, client } = setup(() => ({ book: book('Dune') }));
		const miss = client.query(
			BookQuery,
			{ id: '1' },
			{ fetchPolicy: 'cache-only' },
		);
		await expect(miss).rejects.toBeInstanceOf(CacheMissError);
		await expect(miss).rejects.toThrow(
			'cache-only: the cache does not hold the whole result of Book',
		);
		expect(api.calls).toHaveLength(0);
		await client.query(BookQuery, { id: '1' });
		expect(
			await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'cache-only' }),
		).toEqual({ book: book('Dune') });
	});

	test("a mutation's result updates a cached query", async () => {
		const { api, client } = setup((body) =>
			body.operationName === 'Book'
				? { book: book('Dune') }
				: { rename: book('Arrakis') },
		);
		await client.query(BookQuery, { id: '1' });
		await client.mutate(RenameMutation, { id: '1', title: 'Arrakis' });
		expect(await client.query(BookQuery, { id: '1' })).toEqual({
			book: book('Arrakis'),
		});
		expect(api.calls).toEqual(['Book', 'Rename']);
	});

	test('a failed query writes nothing', async () => {
		const { client, cache } = setup(() => null);
		await expect(client.query(BookQuery, { id: '1' })).rejects.toThrow();
		expect(cache.read(BookQuery, { id: '1' })).toBeUndefined();
	});
});

describe('a cache that throws never fails a call', () => {
	test("a watch that throws after a mutation: mutate resolves, the next watch runs, the error goes to the cache's onError", async () => {
		const reported: unknown[] = [];
		const { client, cache } = setup(
			(body) =>
				body.operationName === 'Book'
					? { book: book('Dune') }
					: { rename: book('Arrakis') },
			normalizedCache({ onError: (error) => reported.push(error) }),
		);
		await client.query(BookQuery, { id: '1' });
		const failure = new Error('render failed');
		cache.watch(BookQuery, { id: '1' }, () => {
			throw failure;
		});
		const second: unknown[] = [];
		cache.watch(BookQuery, { id: '1' }, (data) => second.push(data));
		expect(
			await client.mutate(RenameMutation, { id: '1', title: 'Arrakis' }),
		).toEqual({ rename: book('Arrakis') });
		expect(second).toEqual([{ book: book('Arrakis') }]);
		expect(reported).toEqual([failure]);
	});

	test('a keys function that throws: the query and the mutation return the network’s data, the cache is unchanged', async () => {
		const reported: unknown[] = [];
		const failure = new Error('no isbn');
		const cache = normalizedCache({
			onError: (error) => reported.push(error),
			keys: {
				Book: () => {
					throw failure;
				},
			},
		});
		const { client } = setup(
			(body) =>
				body.operationName === 'Book'
					? { book: book('Dune') }
					: { rename: book('Arrakis') },
			cache,
		);
		expect(await client.query(BookQuery, { id: '1' })).toEqual({
			book: book('Dune'),
		});
		expect(
			await client.mutate(RenameMutation, { id: '1', title: 'Arrakis' }),
		).toEqual({ rename: book('Arrakis') });
		expect(reported).toEqual([failure, failure]);
		expect(cache.read(BookQuery, { id: '1' })).toBeUndefined();
	});
});

describe('an aborted signal wins over the cache', () => {
	test('cache-first: a hit rejects with the signal’s reason', async () => {
		const { api, client } = setup(() => ({ book: book('Dune') }));
		await client.query(BookQuery, { id: '1' });
		const reason = new Error('navigated away');
		const call = { signal: AbortSignal.abort(reason) };
		await expect(client.query(BookQuery, { id: '1' }, call)).rejects.toBe(
			reason,
		);
		expect(api.calls).toEqual(['Book']);
	});

	test('cache-only: a hit and a miss both reject with the signal’s reason', async () => {
		const { client } = setup(() => ({ book: book('Dune') }));
		const reason = new Error('navigated away');
		const call = {
			signal: AbortSignal.abort(reason),
			fetchPolicy: 'cache-only',
		} as const;
		await expect(client.query(BookQuery, { id: '2' }, call)).rejects.toBe(
			reason,
		);
		await client.query(BookQuery, { id: '1' });
		await expect(client.query(BookQuery, { id: '1' }, call)).rejects.toBe(
			reason,
		);
	});
});

describe('fetchPolicy without a cache', () => {
	test('every query goes to the network, whatever the policy', async () => {
		const api = server(() => ({ book: book('Dune') }));
		const client = createGraphQLClient({ url, fetch: api.fetch });
		await client.query(BookQuery, { id: '1' });
		await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'cache-first' });
		await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'no-cache' });
		expect(api.calls).toHaveLength(3);
	});

	test('cache-only throws, naming the fix', async () => {
		const api = server(() => ({ book: book('Dune') }));
		const client = createGraphQLClient({ url, fetch: api.fetch });
		await expect(
			client.query(BookQuery, { id: '1' }, { fetchPolicy: 'cache-only' }),
		).rejects.toThrow(noCache);
		expect(api.calls).toHaveLength(0);
	});

	test('the policy is typed', () => {
		const ok: QueryOptions = { fetchPolicy: 'network-only' };
		// @ts-expect-error: not a fetch policy
		const wrong: QueryOptions = { fetchPolicy: 'cache-and-network' };
		expect([ok, wrong]).toHaveLength(2);
	});
});
