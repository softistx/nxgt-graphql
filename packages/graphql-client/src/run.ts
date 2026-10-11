import type { Batcher } from './batch';
import { cachedOperation } from './cache/typename';
import type { GraphQLCache } from './cache/types';
import type { Deduplicator } from './dedupe';
import { type GraphQLDocument, type Operation, operationOf } from './document';
import { queryThrough } from './fetch-policy';
import { dedupeKey } from './keys';
import type { QueryOptions, QueryRetry } from './options';
import { checkPersistable } from './persisted';
import { writeToCache } from './report';
import { type Sending, send, type Transport } from './send';
import type { OnFailure } from './subscribe';

/** Any operation's document: its variables' type is contravariant. */
export type AnyDocument = GraphQLDocument<unknown, never>;

/** What every call of one client shares: data, and the objects holding its state. */
export interface ClientContext {
	readonly transport: Transport;
	readonly retry: QueryRetry | undefined;
	readonly dedupe: boolean;
	readonly flights: Deduplicator;
	readonly batcher: Batcher | undefined;
	readonly cache: GraphQLCache | undefined;
	readonly onFailure: OnFailure;
}

/** Which call takes which kind of operation, as its refusal names it. */
const callers = {
	query: 'query()',
	mutation: 'mutate()',
	subscription: 'subscribe()',
} as const;

/** A query or a mutation, its failure through the hook before the caller gets it. */
export async function run(
	context: ClientContext,
	document: AnyDocument,
	expected: 'query' | 'mutation',
	variables: unknown,
	call: QueryOptions = {},
): Promise<unknown> {
	const { transport, cache } = context;
	const operation = operationFor(document, expected, transport, cache);
	try {
		if (expected === 'query')
			return await queryThrough(
				cache,
				{
					document,
					variables,
					operationName: operation.operationName,
					signal: call.signal,
				},
				call.fetchPolicy,
				() => sendQuery(context, operation, variables, call),
			);
		const data = await send(transport, operation, variables, {
			call,
			retry: false,
			signal: call.signal,
		});
		if (cache) writeToCache(cache, document, variables, data);
		return data;
	} catch (error) {
		await context.onFailure(error);
		throw error;
	}
}

/** A query: shared with identical ones in flight, then batched. */
function sendQuery(
	{ transport, retry: clientRetry, dedupe, flights, batcher }: ClientContext,
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

/**
 * The document's operation as it is sent: refused before anything is sent
 * when it is not `expected`, and with a cache, `__typename` added.
 */
export function operationFor(
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
