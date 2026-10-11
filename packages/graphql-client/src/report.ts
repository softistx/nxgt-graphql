import type { GraphQLCache } from './cache/types';
import type { GraphQLDocument } from './document';

/**
 * An error raised outside the call that caused it, such as a watch's
 * callback: reported as an uncaught error would be (`reportError` in a
 * browser, else thrown from a microtask), never thrown into the caller.
 */
export function reportError(error: unknown): void {
	const report = (globalThis as { reportError?: (error: unknown) => void })
		.reportError;
	if (typeof report === 'function') report(error);
	else
		queueMicrotask(() => {
			throw error;
		});
}

/**
 * A result kept by the cache: a write that throws (a `keys` function, a
 * watch) is reported, and the caller still gets the network's data.
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
		reportError(error);
	}
}
