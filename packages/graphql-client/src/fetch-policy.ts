import type { GraphQLCache } from './cache/types';
import type { GraphQLDocument } from './document';
import { CacheMissError } from './errors';
import { writeToCache } from './report';

/**
 * Where a query's result comes from, with a cache:
 * - `cache-first` (the default): the cache when it holds the whole
 *   result, else the network, then the result is written;
 * - `network-only`: the network, then the result is written;
 * - `cache-only`: the cache, else a `CacheMissError`;
 * - `no-cache`: the network, and the cache is left as it is.
 *
 * Without a cache, every query goes to the network, and `cache-only` throws.
 */
export type FetchPolicy =
	| 'cache-first'
	| 'network-only'
	| 'cache-only'
	| 'no-cache';

export const noCache =
	"fetchPolicy 'cache-only' needs a cache: pass cache: normalizedCache() to createGraphQLClient";

type AnyDocument = GraphQLDocument<unknown, never>;

/**
 * What the network returned is what the caller gets: the cache only keeps a
 * copy, and a write that throws goes to the cache's `onError`, not to the
 * caller. A signal already aborted wins over a cache hit.
 */
export async function queryThrough(
	cache: GraphQLCache | undefined,
	request: {
		readonly document: AnyDocument;
		readonly variables: unknown;
		readonly operationName: string | undefined;
		readonly signal: AbortSignal | undefined;
	},
	policy: FetchPolicy | undefined,
	network: () => Promise<unknown>,
): Promise<unknown> {
	if (!cache) {
		if (policy === 'cache-only') throw new TypeError(noCache);
		return network();
	}
	const { document, variables } = request;
	const chosen = policy ?? 'cache-first';
	if (chosen === 'cache-first' || chosen === 'cache-only') {
		request.signal?.throwIfAborted();
		const cached = cache.read(document, variables as never);
		if (cached !== undefined) return cached;
		if (chosen === 'cache-only')
			throw new CacheMissError(request.operationName);
	}
	const data = await network();
	if (chosen !== 'no-cache') writeToCache(cache, document, variables, data);
	return data;
}
