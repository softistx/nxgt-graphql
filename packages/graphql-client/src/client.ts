import { createHttpClient } from '@nxgt/httpyz';
import { Batcher } from './batch';
import { Deduplicator } from './dedupe';
import { ApiError, ApiStatusError } from './errors';
import type {
	GraphQLClient,
	GraphQLClientOptions,
	Subscription,
} from './options';
import { type ClientContext, operationFor, run } from './run';
import type { Transport } from './send';
import { EventSubscription, type OnFailure } from './subscribe';

export function createGraphQLClient(
	options: GraphQLClientOptions,
): GraphQLClient {
	const { retry, dedupe = true, cache } = options;
	const transport = transportOf(options);
	const context: ClientContext = {
		transport,
		retry,
		dedupe,
		flights: new Deduplicator(),
		batcher: options.batch ? new Batcher(transport, options.batch) : undefined,
		cache,
		onFailure: failureHook(options),
	};
	return {
		query: (document, ...[variables, call]) =>
			run(context, document, 'query', variables, call) as Promise<never>,
		mutate: (document, ...[variables, call]) =>
			run(context, document, 'mutation', variables, call) as Promise<never>,
		subscribe: (document, ...[variables, options]) =>
			new EventSubscription(
				transport,
				operationFor(document, 'subscription', transport, cache),
				variables,
				options ?? {},
				context.onFailure,
			) as Subscription<never>,
		http: transport.http,
		cache,
	};
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
