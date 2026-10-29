import '../../test/dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from 'bun:test';
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
			wrapper: withClient(client),
			reactStrictMode: true,
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

	test('onOpen is called once the stream is accepted, before any result', async () => {
		const { api, client } = setup();
		const order: string[] = [];
		renderHook(
			() =>
				useSubscription(
					TickSubscription,
					{ room: 'a' },
					{
						onOpen: () => order.push('open'),
						onData: () => order.push('data'),
					},
				),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(order).toEqual(['open']));
		await act(async () => api.streams[0]?.next({ data: { tick: 1 } }));
		await waitFor(() => expect(order).toEqual(['open', 'data']));
	});

	test('a new onOpen between renders does not reconnect; the latest one is used', async () => {
		const { api, client } = setup();
		const calls: string[] = [];
		const { rerender } = renderHook(
			({ tag }: { tag: string }) =>
				useSubscription(
					TickSubscription,
					{ room: 'a' },
					{ onOpen: () => calls.push(tag) },
				),
			{ wrapper: withClient(client), initialProps: { tag: 'first' } },
		);
		rerender({ tag: 'second' });
		rerender({ tag: 'third' });
		await waitFor(() => expect(calls).toHaveLength(1));
		expect(api.streams).toHaveLength(1);
		expect(api.streams[0]?.signal.aborted).toBe(false);
		expect(calls).toEqual(['third']);
	});

	test('onComplete is called when the stream ends cleanly, not on an error', async () => {
		const { api, client } = setup();
		const onComplete = mock(() => {});
		const onError = mock(() => {});
		renderHook(
			() =>
				useSubscription(
					TickSubscription,
					{ room: 'a' },
					{ onComplete, onError },
				),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		await act(async () => api.streams[0]?.complete());
		await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
		expect(onError).not.toHaveBeenCalled();
	});

	test('restart opens a new stream with the same variables and clears the state', async () => {
		const { api, client } = setup();
		const { result } = renderHook(
			() => useSubscription(TickSubscription, { room: 'a' }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		const { restart } = result.current;
		await act(async () => {
			api.streams[0]?.next({ data: { tick: 1 } });
			api.streams[0]?.complete();
		});
		await waitFor(() => expect(result.current.active).toBe(false));
		act(() => result.current.restart());
		await waitFor(() => expect(api.streams).toHaveLength(2));
		expect(api.streams[1]?.variables).toEqual({ room: 'a' });
		expect(result.current).toMatchObject({ data: undefined, active: true });
		expect(result.current.restart).toBe(restart);
		await act(async () => api.streams[1]?.next({ data: { tick: 2 } }));
		await waitFor(() => expect(result.current.data).toEqual({ tick: 2 }));
	});

	test('restart closes an open stream before opening the next', async () => {
		const { api, client } = setup();
		const { result } = renderHook(
			() => useSubscription(TickSubscription, { room: 'a' }),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		act(() => result.current.restart());
		await waitFor(() => expect(api.streams).toHaveLength(2));
		expect(api.streams[0]?.signal.aborted).toBe(true);
		expect(api.streams[1]?.signal.aborted).toBe(false);
	});

	test('a 401 reaches onError, then onUnauthenticated', async () => {
		const calls: string[] = [];
		const client = createGraphQLClient({
			url,
			fetch: async () => new Response('{}', { status: 401 }),
		});
		const { result } = renderHook(
			() =>
				useSubscription(
					TickSubscription,
					{ room: 'a' },
					{
						onError: () => calls.push('error'),
						onUnauthenticated: (error) => calls.push(`401:${error.status}`),
					},
				),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(calls).toEqual(['error', '401:401']));
		expect(result.current.error).toMatchObject({ status: 401 });
	});

	test('an UNAUTHENTICATED error event reaches onUnauthenticated; another error does not', async () => {
		const { api, client } = setup();
		const onUnauthenticated = mock(() => {});
		const onError = mock(() => {});
		const { result } = renderHook(
			() =>
				useSubscription(
					TickSubscription,
					{ room: 'a' },
					{ onError, onUnauthenticated },
				),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(api.streams).toHaveLength(1));
		await act(async () =>
			api.streams[0]?.next({
				errors: [{ message: 'No', extensions: { code: 'UNAUTHENTICATED' } }],
			}),
		);
		await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledTimes(1));
		act(() => result.current.restart());
		await waitFor(() => expect(api.streams).toHaveLength(2));
		await act(async () =>
			api.streams[1]?.next({ errors: [{ message: 'Other' }] }),
		);
		await waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
		expect(onUnauthenticated).toHaveBeenCalledTimes(1);
	});
});
