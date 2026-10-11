import { createHttpClient } from '@nxgt/httpyz';
import { Batcher } from './batch';
import { Deduplicator } from './dedupe';
import { type GraphQLDocument, type Operation, operationOf } from './document';
import { ApiError, ApiStatusError } from './errors';
import { dedupeKey } from './keys';
import type {
	GraphQLClient,
	GraphQLClientOptions,
	QueryOptions,
} from './options';
import { checkPersistable } from './persisted';
import { type Sending, send, type Transport } from './send';

/** Any operation's document: its variables' type is contravariant. */
type AnyDocument = GraphQLDocument<unknown, never>;

export function createGraphQLClient(
	options: GraphQLClientOptions,
): GraphQLClient {
	const { onUnauthenticated, retry: clientRetry, dedupe = true } = options;
	const transport = transportOf(options);
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
		const operation = operationOf(document);
		if (operation.kind !== expected) {
			throw new TypeError(
				`${expected === 'query' ? 'query()' : 'mutate()'} was given a ${operation.kind}`,
			);
		}
		checkPersistable(operation, transport.persisted);
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
