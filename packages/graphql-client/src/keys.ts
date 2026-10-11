import type { Operation } from './document';
import type { QueryOptions, QueryRetry } from './options';

/**
 * Calls alike in all a request carries besides its operation: the same
 * headers, timeout and retries.
 *
 * `retry.delay`, a function, has no JSON: it is not part of the key, so calls
 * differing only in it share a request, sent with the first one's.
 */
export function callKey(
	call: QueryOptions,
	retry: QueryRetry | undefined,
): string {
	return JSON.stringify([[...new Headers(call.headers)], call.timeout, retry]);
}

/** Queries alike in all a request carries share one flight. */
export function dedupeKey(
	operation: Operation,
	variables: unknown,
	call: QueryOptions,
	retry: QueryRetry | undefined,
): string {
	return JSON.stringify([
		operation.query,
		variables ?? {},
		callKey(call, retry),
	]);
}
