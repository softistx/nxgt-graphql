import type { GraphQLCache } from './cache/types';
import type { GraphQLDocument } from './document';

/**
 * The default `onError` for an error raised outside the call that caused
 * it (a watch's callback, a result the cache refused): logged, never
 * thrown, so it never ends a Bun or Node process.
 */
export function logError(error: unknown): void {
	console.error(error);
}

/**
 * A result kept by the cache: a write that throws (a `keys` function, a
 * value JSON could not hold) goes to the cache's `onError` (`logError`
 * when it has none), and the caller still gets the network's data.
 */
export function writeToCache(
	cache: GraphQLCache,
	document: GraphQLDocument<unknown, never>,
	variables: unknown,
	data: unknown,
): void {
	try {
		cache.write(document, variables as never, data as never);
	} catch (error) {
		try {
			(cache.onError ?? logError)(error);
		} catch (reported) {
			// An `onError` that throws must not fail a call that succeeded.
			logError(reported);
		}
	}
}
