import '../../test/dom';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
	act,
	cleanup,
	render,
	renderHook,
	waitFor,
} from '@testing-library/react/pure';
import { createElement, useEffect } from 'react';
import { useDom } from '../../test/dom';
import {
	BookQuery,
	book,
	flush,
	RenameMutation,
	server,
	url,
	withClient,
} from '../../test/react';
import { normalizedCache } from '../cache/normalized-cache';
import { createGraphQLClient } from '../client';
import { ApiError } from '../errors';
import { type MutationState, useMutation } from './use-mutation';
import { useQuery } from './use-query';

useDom(cleanup);

let consoleError: ReturnType<typeof spyOn>;
beforeEach(() => {
	consoleError = spyOn(console, 'error');
});
afterEach(() => {
	expect(consoleError).not.toHaveBeenCalled();
	consoleError.mockRestore();
});

const renamed = (body: { variables: Record<string, unknown> }) => ({
	rename: book(String(body.variables['title'])),
});

describe('useMutation', () => {
	test('idle until called; mutate resolves with the data and records it', async () => {
		const api = server(renamed);
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const { result } = renderHook(() => useMutation(RenameMutation), {
			wrapper: withClient(client),
		});
		expect(result.current[1]).toMatchObject({
			data: undefined,
			error: undefined,
			loading: false,
		});
		let data: unknown;
		await act(async () => {
			data = await result.current[0]({ id: '1', title: 'Dune' });
		});
		expect(data).toEqual({ rename: book('Dune') });
		expect(result.current[1]).toMatchObject({
			data: { rename: book('Dune') },
			error: undefined,
			loading: false,
		});
		expect(api.received).toHaveLength(1);
	});

	test('loading while the call is in flight', async () => {
		const api = server(renamed, { hold: true });
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const { result } = renderHook(() => useMutation(RenameMutation), {
			wrapper: withClient(client),
		});
		let call!: Promise<unknown>;
		act(() => {
			call = result.current[0]({ id: '1', title: 'Dune' });
		});
		expect(result.current[1].loading).toBe(true);
		await waitFor(() => expect(api.received).toHaveLength(1));
		await act(async () => {
			api.received[0]?.answer({ data: { rename: book('Dune') } });
			await call;
		});
		expect(result.current[1].loading).toBe(false);
	});

	test('a failure rejects as client.mutate does, and is recorded', async () => {
		const client = createGraphQLClient({
			url,
			fetch: async () => Response.json({ errors: [{ message: 'Taken' }] }),
		});
		const { result } = renderHook(() => useMutation(RenameMutation), {
			wrapper: withClient(client),
		});
		let rejected: unknown;
		await act(async () => {
			await result.current[0]({ id: '1', title: 'Dune' }).catch((error) => {
				rejected = error;
			});
		});
		expect(rejected).toBeInstanceOf(ApiError);
		expect(result.current[1]).toMatchObject({
			data: undefined,
			error: rejected,
			loading: false,
		});
	});

	test('reset forgets the last call, and a call in flight records nothing', async () => {
		const api = server(renamed, { hold: true });
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const { result } = renderHook(() => useMutation(RenameMutation), {
			wrapper: withClient(client),
		});
		let call!: Promise<unknown>;
		act(() => {
			call = result.current[0]({ id: '1', title: 'Dune' });
		});
		act(() => result.current[1].reset());
		await waitFor(() => expect(api.received).toHaveLength(1));
		await act(async () => {
			api.received[0]?.answer({ data: { rename: book('Dune') } });
			expect(await call).toEqual({ rename: book('Dune') });
		});
		expect(result.current[1]).toMatchObject({
			data: undefined,
			loading: false,
		});
	});

	test('after an unmount, the call still settles and nothing is recorded', async () => {
		const api = server(renamed, { hold: true });
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const { result, unmount } = renderHook(() => useMutation(RenameMutation), {
			wrapper: withClient(client),
		});
		let call!: Promise<unknown>;
		act(() => {
			call = result.current[0]({ id: '1', title: 'Dune' });
		});
		unmount();
		await waitFor(() => expect(api.received).toHaveLength(1));
		api.received[0]?.answer({ data: { rename: book('Dune') } });
		expect(await call).toEqual({ rename: book('Dune') });
		await act(flush);
	});

	test('with a cache, a query showing the entity renders its new fields', async () => {
		const api = server((body) =>
			body.operationName === 'Book' ? { book: book('Dune') } : renamed(body),
		);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			cache: normalizedCache(),
		});
		const { result } = renderHook(
			() => ({
				query: useQuery(BookQuery, { id: '1' }),
				mutation: useMutation(RenameMutation),
			}),
			{ wrapper: withClient(client) },
		);
		await waitFor(() => expect(result.current.query.loading).toBe(false));
		await act(async () => {
			await result.current.mutation[0]({ id: '1', title: 'Dune Messiah' });
		});
		expect(result.current.query.data).toEqual({
			book: book('Dune Messiah'),
		});
	});

	test('two overlapping calls: only the last is recorded, whichever settles last', async () => {
		const api = server(renamed, { hold: true });
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const { result } = renderHook(() => useMutation(RenameMutation), {
			wrapper: withClient(client),
		});
		let first!: Promise<unknown>;
		let second!: Promise<unknown>;
		act(() => {
			first = result.current[0]({ id: '1', title: 'First' });
			second = result.current[0]({ id: '1', title: 'Second' });
		});
		await waitFor(() => expect(api.received).toHaveLength(2));
		await act(async () => {
			api.received[1]?.answer({ data: { rename: book('Second') } });
			await second;
		});
		await act(async () => {
			api.received[0]?.answer({ data: { rename: book('First') } });
			expect(await first).toEqual({ rename: book('First') });
		});
		expect(result.current[1]).toMatchObject({
			data: { rename: book('Second') },
			error: undefined,
			loading: false,
		});
	});

	test('a call from a child’s mount effect records loading', async () => {
		const api = server(renamed, { hold: true });
		const client = createGraphQLClient({ url, fetch: api.fetch });
		let state: MutationState<unknown> | undefined;
		const Child = ({ run }: { run: () => void }) => {
			useEffect(run, []);
			return null;
		};
		const Parent = () => {
			const [rename, current] = useMutation(RenameMutation);
			state = current;
			return createElement(Child, {
				run: () => {
					rename({ id: '1', title: 'Dune' }).catch(() => {});
				},
			});
		};
		const Wrapper = withClient(client);
		render(createElement(Wrapper, { children: createElement(Parent) }));
		expect(state?.loading).toBe(true);
		await waitFor(() => expect(api.received).toHaveLength(1));
		await act(async () => {
			api.received[0]?.answer({ data: { rename: book('Dune') } });
			await flush();
		});
		expect(state).toMatchObject({
			data: { rename: book('Dune') },
			loading: false,
		});
	});
});
