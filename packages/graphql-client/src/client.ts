import { createHttpClient } from '@nxgt/httpyz';
import { Deduplicator } from './dedupe';
import { type GraphQLDocument, type Operation, operationOf } from './document';
import { ApiError, ApiStatusError } from './errors';
import type {
	GraphQLClient,
	GraphQLClientOptions,
	QueryOptions,
	QueryRetry,
} from './options';
import { send, type Transport } from './send';

/** Any operation's document: its variables' type is contravariant. */
type AnyDocument = GraphQLDocument<unknown, never>;

export function createGraphQLClient(
	options: GraphQLClientOptions,
): GraphQLClient {
	const { onUnauthenticated, retry: clientRetry, dedupe = true } = options;
	const transport = transportOf(options);
	const flights = new Deduplicator();

	function sendQuery(
		operation: Operation,
		variables: unknown,
		call: QueryOptions,
	): Promise<unknown> {
		const retry = call.retry ?? clientRetry;
		if (!dedupe)
			return send(transport, operation, variables, {
				call,
				retry,
				signal: call.signal,
			});
		return flights.run(
			dedupeKey(operation, variables, call, retry),
			call.signal,
			(signal) =>
				send(transport, operation, variables, { call, retry, signal }),
		);
	}

	async function run(
		document: AnyDocument,
		expected: 'query' | 'mutation',
		variables: unknown,
		call: QueryOptions = {},
	): Promise<unknown> {
		const operation = operationOf(document);
		if (operation.kind !== expected) {
			throw new TypeError(
				`${expected === 'query' ? 'query()' : 'mutate()'} was given a ${operation.kind}`,
			);
		}
		try {
			if (expected === 'query')
				return await sendQuery(operation, variables, call);
			return await send(transport, operation, variables, {
				call,
				retry: false,
				signal: call.signal,
			});
		} catch (error) {
			if (onUnauthenticated && isUnauthenticated(error))
				await onUnauthenticated(error);
			throw error;
		}
	}

	return {
		query: (document, ...[variables, call]) =>
			run(document, 'query', variables, call) as Promise<never>,
		mutate: (document, ...[variables, call]) =>
			run(document, 'mutation', variables, call) as Promise<never>,
		http: transport.http,
	};
}

function transportOf(options: GraphQLClientOptions): Transport {
	if (options.http)
		return { http: options.http, path: options.path ?? '/graphql' };
	const {
		url,
		onUnauthenticated: _hook,
		retry: _retry,
		dedupe: _dedupe,
		...http
	} = options;
	return { http: createHttpClient({ ...http, baseUrl: url }), path: '' };
}

/** Queries alike in all a request carries share one flight. */
function dedupeKey(
	operation: Operation,
	variables: unknown,
	call: QueryOptions,
	retry: QueryRetry | undefined,
): string {
	return JSON.stringify([
		operation.query,
		variables ?? {},
		[...new Headers(call.headers)],
		call.timeout,
		retry,
	]);
}

function isUnauthenticated(error: unknown): error is ApiError | ApiStatusError {
	return (
		(error instanceof ApiError || error instanceof ApiStatusError) &&
		error.status === 401
	);
}
