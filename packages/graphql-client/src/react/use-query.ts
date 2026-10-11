import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from 'react';
import type { GraphQLDocument } from '../document';
import type { FetchPolicy } from '../fetch-policy';
import type { VariablesArgs } from '../options';
import { useClient } from './context';
import {
	type QueryRequest,
	type QueryState,
	refetchQuery,
	startQuery,
	stateFor,
} from './query-run';
import { headersKey, useStable, variablesKey } from './stable';
import { useWatched, type WatchedRead } from './watched';

export interface UseQueryOptions {
	/** Sends nothing and holds no data while `true`. Default: `false`. */
	readonly skip?: boolean;
	/**
	 * Where the result comes from, as `client.query`'s option. Default:
	 * `cache-first` with a cache, the network without one.
	 */
	readonly fetchPolicy?: FetchPolicy;
	/** Over the client's headers, for this query. Compared by value. */
	readonly headers?: HeadersInit;
}

export interface QueryResult<TResult> {
	/** The result: with a cache, as the cache holds it now; else the last answer. */
	readonly data: TResult | undefined;
	/** What the last request rejected with: an `ApiError`, an `ApiStatusError`… Never an abort. */
	readonly error: unknown;
	/** A request for these variables is in flight and no cached result answers it. */
	readonly loading: boolean;
	/**
	 * The query again from the network; resolves with its data, rejects as
	 * `client.query` does. Rejects at once, sending nothing, while `skip` is
	 * true (an `Error`) and once kept past its variables or its component (an
	 * `AbortError`).
	 */
	readonly refetch: () => Promise<TResult>;
}

const idle: QueryState = {
	request: undefined,
	data: undefined,
	error: undefined,
	loading: false,
};

/**
 * Runs a query from an effect, never during a render, and again whenever its
 * variables change by value. With a cache, `data` follows the cache: a write
 * elsewhere that changes the result renders the component again.
 */
export function useQuery<TResult, TVariables>(
	document: GraphQLDocument<TResult, TVariables>,
	...[raw, options = {}]: VariablesArgs<NoInfer<TVariables>, UseQueryOptions>
): QueryResult<TResult> {
	const client = useClient();
	const { skip = false, fetchPolicy } = options;
	const variables = useStable(raw, variablesKey(raw));
	const headers = useStable(options.headers, headersKey(options.headers));
	const request = useMemo<QueryRequest>(
		() => ({
			client,
			document: document as GraphQLDocument<unknown, never>,
			variables,
			skip,
			fetchPolicy,
			headers,
			refetches: new Set(),
			disposed: false,
		}),
		[client, document, variables, skip, fetchPolicy, headers],
	);
	const cached = useWatched(useMemo(() => cacheRead(request), [request]));
	const [state, setState] = useState(idle);
	// Before the effect: StrictMode's replay runs layout effects again before
	// passive ones, so `disposed` is clear when a child's mount effect replays.
	useLayoutEffect(() => {
		request.disposed = false;
		return () => {
			request.disposed = true;
		};
	}, [request]);
	useEffect(() => startQuery(request, setState), [request]);
	const refetch = useCallback(
		() => refetchQuery(request, setState) as Promise<TResult>,
		[request],
	);
	const answered = cached !== undefined && fromCache(request);
	const shown = stateFor(state, request, !skip && !answered);
	return {
		data: (cached ?? shown.data) as TResult | undefined,
		error: shown.error,
		loading: shown.loading,
		refetch,
	};
}

/** The cache read a request shows, unless it skips or its policy leaves the cache alone. */
function cacheRead({
	client: { cache },
	document,
	variables,
	skip,
	fetchPolicy,
}: QueryRequest): WatchedRead<unknown> | undefined {
	if (!cache || skip || fetchPolicy === 'no-cache') return undefined;
	return {
		read: () => cache.read(document, variables as never),
		watch: (callback) => cache.watch(document, variables as never, callback),
	};
}

/** A request the cache answers when it holds the whole result: no loading then. */
function fromCache({ client, fetchPolicy }: QueryRequest): boolean {
	return (
		client.cache !== undefined &&
		(fetchPolicy === undefined ||
			fetchPolicy === 'cache-first' ||
			fetchPolicy === 'cache-only')
	);
}
