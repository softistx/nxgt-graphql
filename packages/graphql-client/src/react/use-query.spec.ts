import '../../test/dom';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react/pure';
import { parse } from 'graphql';
import { useDom } from '../../test/dom';
import {
	BookQuery,
	book,
	flush,
	server,
	url,
	withClient,
} from '../../test/react';
import { normalizedCache } from '../cache/normalized-cache';
import { createGraphQLClient } from '../client';
import { ApiError, CacheMissError } from '../errors';
import type { FetchPolicy } from '../fetch-policy';
import { skipRefetch } from './query-run';
import { useQuery } from './use-query';

useDom(cleanup);

const EventsQuery = parse(
	'query Events($at: DateTime!) { events(at: $at) }',
) as TypedDocumentNode<{ events: string[] }, { at: Date }>;

let consoleError: ReturnType<typeof spyOn>;
beforeEach(() => {
	consoleError = spyOn(console, 'error');
});
afterEach(() => {
	expect(consoleError).not.toHaveBeenCalled();
	consoleError.mockRestore();
});

function setup(options: { cache?: boolean; hold?: boolean } = {}) {
	const api = server(
		(body) => ({
			book: book(`Dune ${body.variables['id']}`, `${body.variables['id']}`),
		}),
		{ hold: options.hold ?? false },
	);
	const client = createGraphQLClient({
		url,
		fetch: api.fetch,
		...(options.cache && { cache: normalizedCache() }),
	});
	return { api, client };
}

describe('useQuery without a cache', () => {
	test('loading, then the data', async () => {
		const { api, client } = setup();
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		expect(result.current).toMatchObject({ data: undefined, loading: true });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toEqual({ book: book('Dune 1') });
		expect(result.current.error).toBeUndefined();
		expect(api.received.map((r) => r.body.variables)).toEqual([{ id: '1' }]);
	});

	test('an error is the client’s error, not thrown', async () => {
		const { api, client } = setup({ hold: true });
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		await waitFor(() => expect(api.received).toHaveLength(1));
		await act(async () => {
			api.received[0]?.answer({ errors: [{ message: 'No book' }] });
			await flush();
		});
		expect(result.current.loading).toBe(false);
		expect(result.current.data).toBeUndefined();
		expect(result.current.error).toBeInstanceOf(ApiError);
	});

	test('the same variables in a new object send nothing again', async () => {
		const { api, client } = setup();
		const { result, rerender } = renderHook(
			({ id }) => useQuery(BookQuery, { id }),
			{ wrapper: withClient(client), initialProps: { id: '1' } },
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		rerender({ id: '1' });
		rerender({ id: '1' });
		await act(flush);
		expect(api.received).toHaveLength(1);
		rerender({ id: '2' });
		expect(result.current).toMatchObject({ data: undefined, loading: true });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toEqual({ book: book('Dune 2', '2') });
		expect(api.received).toHaveLength(2);
	});

	test('new variables abort the request in flight, and the abort is no error', async () => {
		const { api, client } = setup({ hold: true });
		const { result, rerender } = renderHook(
			({ id }) => useQuery(BookQuery, { id }),
			{ wrapper: withClient(client), initialProps: { id: '1' } },
		);
		await waitFor(() => expect(api.received).toHaveLength(1));
		rerender({ id: '2' });
		await waitFor(() => expect(api.received).toHaveLength(2));
		expect(api.received[0]?.signal.aborted).toBe(true);
		await act(async () => {
			api.received[1]?.answer({ data: { book: book('Two', '2') } });
			await flush();
		});
		expect(result.current).toMatchObject({
			data: { book: book('Two', '2') },
			error: undefined,
			loading: false,
		});
	});

	test('an unmount aborts the request, and nothing is recorded after', async () => {
		const { api, client } = setup({ hold: true });
		const { unmount } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		await waitFor(() => expect(api.received).toHaveLength(1));
		unmount();
		expect(api.received[0]?.signal.aborted).toBe(true);
		api.received[0]?.answer({ data: { book: book('Late') } });
		await act(flush);
	});

	test('StrictMode’s second effect leaves one live request, the first aborted', async () => {
		const { api, client } = setup();
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client, { strict: true }),
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toEqual({ book: book('Dune 1') });
		expect(result.current.error).toBeUndefined();
		const live = api.received.filter((r) => !r.signal.aborted);
		expect(live).toHaveLength(1);
	});

	test('skip sends nothing until it is false', async () => {
		const { api, client } = setup();
		const { result, rerender } = renderHook(
			({ skip }) => useQuery(BookQuery, { id: '1' }, { skip }),
			{ wrapper: withClient(client), initialProps: { skip: true } },
		);
		await act(flush);
		expect(result.current).toMatchObject({ data: undefined, loading: false });
		expect(api.received).toHaveLength(0);
		rerender({ skip: false });
		expect(result.current.loading).toBe(true);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(api.received).toHaveLength(1);
	});

	test('headers go with the request, compared by value', async () => {
		const { api, client } = setup();
		const { result, rerender } = renderHook(
			() => useQuery(BookQuery, { id: '1' }, { headers: { 'x-tenant': 'a' } }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		rerender();
		await act(flush);
		expect(api.received).toHaveLength(1);
		expect(api.received[0]?.headers.get('x-tenant')).toBe('a');
	});

	test('refetch asks the network again and resolves with its data', async () => {
		let title = 'Dune';
		const api = server(() => ({ book: book(title) }));
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
		title = 'Dune Messiah';
		let refetched: unknown;
		await act(async () => {
			refetched = await result.current.refetch();
		});
		expect(refetched).toEqual({ book: book('Dune Messiah') });
		expect(result.current.data).toEqual({ book: book('Dune Messiah') });
		expect(api.received).toHaveLength(2);
	});

	test('refetch rejects as client.query does, and records the error', async () => {
		const client = createGraphQLClient({
			url,
			fetch: async () => Response.json({ errors: [{ message: 'Down' }] }),
		});
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
		let rejected: unknown;
		await act(async () => {
			await result.current.refetch().catch((error) => {
				rejected = error;
			});
		});
		expect(rejected).toBeInstanceOf(ApiError);
		expect(result.current).toMatchObject({ error: rejected, loading: false });
	});
	test('refetch while skip is true rejects at once, sends nothing, sets nothing', async () => {
		const { api, client } = setup();
		const { result } = renderHook(
			() => useQuery(BookQuery, { id: '1' }, { skip: true }),
			{ wrapper: withClient(client) },
		);
		const before = result.current;
		let rejected: unknown;
		await act(async () => {
			await result.current.refetch().catch((error) => {
				rejected = error;
			});
		});
		expect(rejected).toBeInstanceOf(Error);
		expect((rejected as Error).message).toBe(skipRefetch);
		expect(api.received).toHaveLength(0);
		expect(result.current).toMatchObject({
			data: undefined,
			error: undefined,
			loading: false,
		});
		expect(result.current.refetch).toBe(before.refetch);
	});

	test('a refetch kept past new variables rejects with an AbortError, sends and changes nothing', async () => {
		const { api, client } = setup();
		const { result, rerender } = renderHook(
			({ id }) => useQuery(BookQuery, { id }),
			{ wrapper: withClient(client), initialProps: { id: '1' } },
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		const stale = result.current.refetch;
		rerender({ id: '2' });
		await waitFor(() => expect(result.current.loading).toBe(false));
		const shown = result.current;
		let rejected: unknown;
		await act(async () => {
			await stale().catch((error) => {
				rejected = error;
			});
			await flush();
		});
		expect(rejected).toBeInstanceOf(DOMException);
		expect((rejected as DOMException).name).toBe('AbortError');
		expect(api.received).toHaveLength(2);
		expect(result.current.data).toBe(shown.data);
		expect(result.current).toMatchObject({
			data: { book: book('Dune 2', '2') },
			error: undefined,
			loading: false,
		});
	});

	test('a refetch in flight is aborted on unmount, and nothing is recorded after', async () => {
		const { api, client } = setup({ hold: true });
		const { result, unmount } = renderHook(
			() => useQuery(BookQuery, { id: '1' }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.received).toHaveLength(1));
		await act(async () => {
			api.received[0]?.answer({ data: { book: book('Dune') } });
			await flush();
		});
		let refetched!: Promise<unknown>;
		act(() => {
			refetched = result.current.refetch();
		});
		const settled = refetched.then(
			() => 'resolved',
			(error: unknown) => error,
		);
		await waitFor(() => expect(api.received).toHaveLength(2));
		const shown = result.current;
		unmount();
		expect(api.received[1]?.signal.aborted).toBe(true);
		api.received[1]?.answer({ data: { book: book('Late') } });
		expect(((await settled) as DOMException).name).toBe('AbortError');
		await act(flush);
		expect(result.current).toBe(shown);
		expect(shown).toMatchObject({
			data: { book: book('Dune') },
			loading: true,
		});
	});

	test('two Date variables are two requests: they are compared by their JSON', async () => {
		const api = server(() => ({ events: [] }));
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const { result, rerender } = renderHook(
			({ at }) => useQuery(EventsQuery, { at }),
			{
				wrapper: withClient(client),
				initialProps: { at: new Date('2026-01-01T00:00:00.000Z') },
			},
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		rerender({ at: new Date('2026-01-01T00:00:00.000Z') });
		await act(flush);
		expect(api.received).toHaveLength(1);
		rerender({ at: new Date('2026-06-01T00:00:00.000Z') });
		await waitFor(() => expect(api.received).toHaveLength(2));
		expect(api.received.map((r) => r.body.variables['at'])).toEqual([
			'2026-01-01T00:00:00.000Z',
			'2026-06-01T00:00:00.000Z',
		]);
	});
});

describe('useQuery with a cache', () => {
	test('a cache-first hit renders at once, with no request and no loading', async () => {
		const { api, client } = setup({ cache: true });
		client.cache?.write(BookQuery, { id: '1' }, { book: book('Cached') });
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		expect(result.current).toMatchObject({
			data: { book: book('Cached') },
			loading: false,
		});
		await act(flush);
		expect(api.received).toHaveLength(0);
	});

	test('a write elsewhere changes the data, with no request', async () => {
		const { api, client } = setup({ cache: true });
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			client.cache?.modify('Book:1', { title: () => 'Renamed' });
		});
		expect(result.current.data).toEqual({ book: book('Renamed') });
		expect(api.received).toHaveLength(1);
	});

	test('refetch goes to the network even when the cache holds the result', async () => {
		const { api, client } = setup({ cache: true });
		client.cache?.write(BookQuery, { id: '1' }, { book: book('Cached') });
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		await act(async () => {
			await result.current.refetch();
		});
		expect(api.received).toHaveLength(1);
		expect(result.current.data).toEqual({ book: book('Dune 1') });
	});

	test.each(['network-only', 'no-cache'] as FetchPolicy[])(
		'%s asks the network despite a hit',
		async (fetchPolicy) => {
			const { api, client } = setup({ cache: true });
			client.cache?.write(BookQuery, { id: '1' }, { book: book('Cached') });
			const { result } = renderHook(
				() => useQuery(BookQuery, { id: '1' }, { fetchPolicy }),
				{ wrapper: withClient(client) },
			);
			expect(result.current.loading).toBe(true);
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.data).toEqual({ book: book('Dune 1') });
			expect(api.received).toHaveLength(1);
			const kept = client.cache?.read(BookQuery, { id: '1' })?.book.title;
			expect(kept).toBe(fetchPolicy === 'no-cache' ? 'Cached' : 'Dune 1');
		},
	);

	test('an evicted entity falls back to the network’s last answer', async () => {
		const { api, client } = setup({ cache: true });
		const { result } = renderHook(() => useQuery(BookQuery, { id: '1' }), {
			wrapper: withClient(client),
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			client.cache?.modify('Book:1', { title: () => 'Renamed' });
		});
		expect(result.current.data).toEqual({ book: book('Renamed') });
		act(() => {
			client.cache?.evict('Book:1');
		});
		expect(result.current).toMatchObject({
			data: { book: book('Dune 1') },
			error: undefined,
			loading: false,
		});
		expect(api.received).toHaveLength(1);
	});

	test('a cache-only miss is recorded as a CacheMissError, with no request', async () => {
		const { api, client } = setup({ cache: true });
		const { result } = renderHook(
			() => useQuery(BookQuery, { id: '1' }, { fetchPolicy: 'cache-only' }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBeInstanceOf(CacheMissError);
		expect(result.current.data).toBeUndefined();
		expect(api.received).toHaveLength(0);
	});
});
