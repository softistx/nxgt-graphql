import { createHttpClient } from '@nxgt/httpyz';
import { Batcher } from './batch';
import { cachedOperation } from './cache/typename';
import type { GraphQLCache } from './cache/types';
import { Deduplicator } from './dedupe';
import { type GraphQLDocument, type Operation, operationOf } from './document';
import { ApiError, ApiStatusError } from './errors';
import { queryThrough } from './fetch-policy';
import { dedupeKey } from './keys';
import type {
	GraphQLClient,
	GraphQLClientOptions,
	QueryOptions,
	Subscription,
} from './options';
import { checkPersistable } from './persisted';
import { type Sending, send, type Transport } from './send';
import { EventSubscription, type OnFailure } from './subscribe';

/** Any operation's document: its variables' type is contravariant. */
type AnyDocument = GraphQLDocument<unknown, never>;

/** Which call takes which kind of operation, as its refusal names it. */
const callers = {
	query: 'query()',
	mutation: 'mutate()',
	subscription: 'subscribe()',
} as const;

export function createGraphQLClient(
	options: GraphQLClientOptions,
): GraphQLClient {
	const { retry: clientRetry, dedupe = true, cache } = options;
	const transport = transportOf(options);
	const onFailure = failureHook(options);
	const flights = new Deduplicator();
	const batcher = options.batch
		? new Batcher(transport, options.batch)
		: undefined;

	/** A query: shared with identical ones in flight, then batched. */
	function sendQuery(
		operation: Operation,
		variables: unknown,
		call: QueryOptions,
	): Promise<unknown> {
		const retry = call.retry ?? clientRetry;
		const go = (signal: AbortSignal | undefined) => {
			const sending: Sending = { call, retry, signal };
			return batcher
				? batcher.run(operation, variables, sending)
				: send(transport, operation, variables, sending);
		};
		if (!dedupe) return go(call.signal);
		return flights.run(
			dedupeKey(operation, variables, call, retry),
			call.signal,
			go,
		);
	}

	async function run(
		document: AnyDocument,
		expected: 'query' | 'mutation',
		variables: unknown,
		call: QueryOptions = {},
	): Promise<unknown> {
		const operation = operationFor(document, expected, transport, cache);
		try {
			if (expected === 'query')
				return await queryThrough(
					cache,
					{ document, variables, operationName: operation.operationName },
					call.fetchPolicy,
					() => sendQuery(operation, variables, call),
				);
			const data = await send(transport, operation, variables, {
				call,
				retry: false,
				signal: call.signal,
			});
			cache?.write(document, variables as never, data as never);
			return data;
		} catch (error) {
			await onFailure(error);
			throw error;
		}
	}

	return {
		query: (document, ...[variables, call]) =>
			run(document, 'query', variables, call) as Promise<never>,
		mutate: (document, ...[variables, call]) =>
			run(document, 'mutation', variables, call) as Promise<never>,
		subscribe: (document, ...[variables, options]) =>
			new EventSubscription(
				transport,
				operationFor(document, 'subscription', transport, cache),
				variables,
				options ?? {},
				onFailure,
			) as Subscription<never>,
		http: transport.http,
		cache,
	};
}

/**
 * The document's operation as it is sent: refused before anything is sent
 * when it is not `expected`, and with a cache, `__typename` added.
 */
function operationFor(
	document: AnyDocument,
	expected: Operation['kind'],
	transport: Transport,
	cache: GraphQLCache | undefined,
): Operation {
	const operation = operationOf(document);
	if (operation.kind !== expected)
		throw new TypeError(`${callers[expected]} was given a ${operation.kind}`);
	checkPersistable(operation, transport.persisted);
	return cache ? cachedOperation(operation, transport.persisted) : operation;
}

/** What runs before a caller gets an error: the 401 hook, awaited. */
function failureHook({ onUnauthenticated }: GraphQLClientOptions): OnFailure {
	return async (error) => {
		if (onUnauthenticated && isUnauthenticated(error))
			await onUnauthenticated(error);
	};
}

function transportOf(options: GraphQLClientOptions): Transport {
	const persisted = options.persisted ?? false;
	if (options.http)
		return { http: options.http, path: options.path ?? '/graphql', persisted };
	const {
		url,
		onUnauthenticated: _hook,
		retry: _retry,
		dedupe: _dedupe,
		persisted: _persisted,
		batch: _batch,
		cache: _cache,
		...http
	} = options;
	return {
		http: createHttpClient({ ...http, baseUrl: url }),
		path: '',
		persisted,
	};
}

function isUnauthenticated(error: unknown): error is ApiError | ApiStatusError {
	return (
		(error instanceof ApiError || error instanceof ApiStatusError) &&
		error.status === 401
	);
}
