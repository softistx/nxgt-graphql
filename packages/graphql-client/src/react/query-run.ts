import type { Dispatch, SetStateAction } from 'react';
import type { GraphQLDocument } from '../document';
import type { FetchPolicy } from '../fetch-policy';
import type { GraphQLClient } from '../options';

/** What one `useQuery` asks for: a new one whenever any of it changes by value. */
export interface QueryRequest {
	readonly client: GraphQLClient;
	readonly document: GraphQLDocument<unknown, never>;
	readonly variables: unknown;
	readonly skip: boolean;
	readonly fetchPolicy: FetchPolicy | undefined;
	readonly headers: HeadersInit | undefined;
	/** Each refetch in flight, aborted with the request. */
	readonly refetches: Set<AbortController>;
}

/** What the network answered for a request. */
export interface QueryState {
	readonly request: QueryRequest | undefined;
	readonly data: unknown;
	readonly error: unknown;
	readonly loading: boolean;
}

export type SetQueryState = Dispatch<SetStateAction<QueryState>>;

/**
 * Runs the request once, from an effect, never during a render: the
 * cleanup aborts it and its refetches, so an unmount, a change of variables
 * or StrictMode's second run never leaves a request behind. What an abort
 * rejects with is not an error to show.
 */
export function startQuery(
	request: QueryRequest,
	setState: SetQueryState,
): () => void {
	const controller = new AbortController();
	if (!request.skip) {
		const { signal } = controller;
		const call = queryOnce(request, signal, request.fetchPolicy);
		settle(request, call, signal, setState).catch(() => {});
	}
	return () => {
		controller.abort();
		for (const refetch of request.refetches) refetch.abort();
		request.refetches.clear();
	};
}

/**
 * The request again, from the network: `no-cache` stays `no-cache`, any
 * other policy is `network-only`. It rejects as `client.query` does.
 */
export function refetchQuery(
	request: QueryRequest,
	setState: SetQueryState,
): Promise<unknown> {
	const controller = new AbortController();
	request.refetches.add(controller);
	setState((state) => ({ ...stateFor(state, request), loading: true }));
	const policy =
		request.fetchPolicy === 'no-cache' ? 'no-cache' : 'network-only';
	const call = queryOnce(request, controller.signal, policy);
	return settle(request, call, controller.signal, setState).finally(() =>
		request.refetches.delete(controller),
	);
}

/** The state held for this request, else the state of a request not answered yet. */
export function stateFor(
	state: QueryState,
	request: QueryRequest,
	loading = false,
): QueryState {
	if (state.request === request) return state;
	return { request, data: undefined, error: undefined, loading };
}

function queryOnce(
	{ client, document, variables, headers }: QueryRequest,
	signal: AbortSignal,
	fetchPolicy: FetchPolicy | undefined,
): Promise<unknown> {
	return client.query(document, variables as never, {
		signal,
		...(headers !== undefined && { headers }),
		...(fetchPolicy !== undefined && { fetchPolicy }),
	});
}

/** The answer recorded, unless the call was aborted; the promise settles as the call did. */
async function settle(
	request: QueryRequest,
	call: Promise<unknown>,
	signal: AbortSignal,
	setState: SetQueryState,
): Promise<unknown> {
	try {
		const data = await call;
		if (!signal.aborted)
			setState({ request, data, error: undefined, loading: false });
		return data;
	} catch (error) {
		if (!signal.aborted)
			setState((state) => ({
				...stateFor(state, request),
				error,
				loading: false,
			}));
		throw error;
	}
}
