import '../../test/dom';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react/pure';
import { useDom } from '../../test/dom';
import {
	BookQuery,
	eventServer,
	TickSubscription,
	url,
	withClient,
} from '../../test/react';
import { createGraphQLClient } from '../client';
import { ApiError } from '../errors';
import { useSubscription } from './use-subscription';

useDom(cleanup);

let consoleError: ReturnType<typeof spyOn>;
beforeEach(() => {
	consoleError = spyOn(console, 'error');
});
afterEach(() => {
	expect(consoleError).not.toHaveBeenCalled();
	consoleError.mockRestore();
});

function setup() {
	const api = eventServer();
	const client = createGraphQLClient({ url, fetch: api.fetch });
	return { api, client };
}

describe('useSubscription', () => {
	test('active, then each result as it comes, onData first', async () => {
		const { api, client } = setup();
		const seen: number[] = [];
		const { result } = renderHook(
			() =>
				useSubscription(
					TickSubscription,
					{ room: 'a' },
					{ onData: ({ tick }) => seen.push(tick) },
				),
			{ wrapper: withClient(client) },
		);
		expect(result.current).toMatchObject({ data: undefined, active: true });
		await waitFor(() => expect(api.streams).toHaveLength(1));
		expect(api.streams[0]?.variables).toEqual({ room: 'a' });
		await act(async () => api.streams[0]?.next({ data: { tick: 1 } }));
		await waitFor(() => expect(result.current.data).toEqual({ tick: 1 }));
		await act(async () => api.streams[0]?.next({ data: { tick: 2 } }));
		await waitFor(() => expect(result.current.data).toEqual({ tick: 2 }));
		expect(seen).toEqual([1, 2]);
	});

	test('complete ends it: the last data stays, active is false', async () => {
		const { api, client } = setup();
		const { result } = renderHook(
			() => useSubscription(TickSubscription, { room: 'a' }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		await act(async () => {
			api.streams[0]?.next({ data: { tick: 1 } });
			api.streams[0]?.complete();
		});
		await waitFor(() => expect(result.current.active).toBe(false));
		expect(result.current).toMatchObject({
			data: { tick: 1 },
			error: undefined,
		});
	});

	test('an error ends it and is recorded', async () => {
		const { api, client } = setup();
		const { result } = renderHook(
			() => useSubscription(TickSubscription, { room: 'a' }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		await act(async () =>
			api.streams[0]?.next({ errors: [{ message: 'No' }] }),
		);
		await waitFor(() => expect(result.current.active).toBe(false));
		expect(result.current.error).toBeInstanceOf(ApiError);
	});

	test('an unmount closes the connection', async () => {
		const { api, client } = setup();
		const { unmount } = renderHook(
			() => useSubscription(TickSubscription, { room: 'a' }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		unmount();
		expect(api.streams[0]?.signal.aborted).toBe(true);
	});

	test('new variables close the old connection and open another; the same ones do not', async () => {
		const { api, client } = setup();
		const { result, rerender } = renderHook(
			({ room }) => useSubscription(TickSubscription, { room }),
			{ wrapper: withClient(client), initialProps: { room: 'a' } },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		rerender({ room: 'a' });
		rerender({ room: 'b' });
		await waitFor(() => expect(api.streams).toHaveLength(2));
		expect(api.streams[0]?.signal.aborted).toBe(true);
		expect(api.streams[1]?.variables).toEqual({ room: 'b' });
		expect(result.current).toMatchObject({ error: undefined, active: true });
	});

	test('skip connects nothing', async () => {
		const { api, client } = setup();
		const { result } = renderHook(
			() => useSubscription(TickSubscription, { room: 'a' }, { skip: true }),
			{ wrapper: withClient(client) },
		);
		await act(async () => {});
		expect(result.current).toMatchObject({ data: undefined, active: false });
		expect(api.streams).toHaveLength(0);
	});

	test('StrictMode leaves one open connection', async () => {
		const { api, client } = setup();
		renderHook(() => useSubscription(TickSubscription, { room: 'a' }), {
			wrapper: withClient(client, { strict: true }),
		});
		await waitFor(() =>
			expect(api.streams.filter((s) => !s.signal.aborted)).toHaveLength(1),
		);
	});

	test('a query given to it is an error, not a throw', async () => {
		const { client } = setup();
		const { result } = renderHook(
			() => useSubscription(BookQuery as never, { id: '1' } as never),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(result.current.active).toBe(false));
		expect(String(result.current.error)).toContain(
			'subscribe() was given a query',
		);
	});

	test('an onData that throws ends it, and what it threw is the error', async () => {
		const { api, client } = setup();
		const thrown = new Error('onData failed');
		const { result } = renderHook(
			() =>
				useSubscription(
					TickSubscription,
					{ room: 'a' },
					{
						onData: () => {
							throw thrown;
						},
					},
				),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		await act(async () => api.streams[0]?.next({ data: { tick: 1 } }));
		await waitFor(() => expect(result.current.active).toBe(false));
		expect(result.current.error).toBe(thrown);
		expect(api.streams[0]?.signal.aborted).toBe(true);
	});
});
