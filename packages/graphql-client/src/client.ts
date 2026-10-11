import {
	type AnyReply,
	createHttpClient,
	type HttpClient,
	type HttpClientOptions,
	NetworkError,
	type RetryOptions,
	TimeoutError,
} from '@nxgt/httpyz';
import { Deduplicator } from './dedupe.js';
import {
	type GraphQLDocument,
	type Operation,
	operationOf,
} from './document.js';
import {
	ApiError,
	type ApiErrorEntry,
	ApiStatusError,
	ApiUnavailableError,
} from './errors.js';

/** A query's retries: always over POST, which is how GraphQL is sent. */
export type QueryRetry = number | Omit<RetryOptions, 'methods'> | false;

interface CommonOptions {
	/**
	 * Runs when the API answers 401 (the HTTP status, or a GraphQL error's
	 * `extensions.http.status`) and the transport's `auth.refresh` did not
	 * save the call. What it throws, such as a redirect, is what the caller
	 * gets; when it returns, the caller gets the `ApiError` or
	 * `ApiStatusError`.
	 */
	onUnauthenticated?: (error: ApiError | ApiStatusError) => void;
	/** Retries of a query. A mutation is never sent twice. Default: none. */
	retry?: QueryRetry;
	/** Identical queries in flight share one request. Default: `true`. */
	dedupe?: boolean;
}

/** A client of its own: the endpoint's URL, and `@nxgt/httpyz`'s options. */
export interface UrlClientOptions
	extends CommonOptions,
		Omit<HttpClientOptions, 'baseUrl' | 'retry'> {
	/** The GraphQL endpoint: `https://api.example.com/graphql`. */
	url: string | URL;
	http?: never;
	path?: never;
}

/** Over an `@nxgt/httpyz` client the application already has. */
export interface HttpClientBasedOptions extends CommonOptions {
	http: HttpClient;
	/** The endpoint's path under the client's `baseUrl`. Default: `/graphql`. */
	path?: string;
	url?: never;
}

export type GraphQLClientOptions = UrlClientOptions | HttpClientBasedOptions;

/** What a call may add. */
export interface CallOptions {
	/** Aborts the call: it rejects with the signal's reason. */
	signal?: AbortSignal;
	/** Over the client's headers, for this call. */
	headers?: HeadersInit;
	/** This call's timeout in milliseconds, instead of the client's. */
	timeout?: number;
}

export interface QueryOptions extends CallOptions {
	/** This query's retries, instead of the client's. */
	retry?: QueryRetry;
}

/** The variables, optional when the operation requires none. */
export type VariablesArgs<TVariables, TOptions> =
	Record<string, never> extends TVariables
		? [variables?: TVariables, options?: TOptions]
		: [variables: TVariables, options?: TOptions];

export interface GraphQLClient {
	/** Runs a query and returns its `data`; any GraphQL error throws. */
	query<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: VariablesArgs<TVariables, QueryOptions>
	): Promise<TResult>;
	/** Runs a mutation and returns its `data`; any GraphQL error throws. It is never retried. */
	mutate<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: VariablesArgs<TVariables, CallOptions>
	): Promise<TResult>;
	/** The transport, for what is not GraphQL. */
	readonly http: HttpClient;
}

/** Any operation's document: its variables' type is contravariant. */
type AnyDocument = GraphQLDocument<unknown, never>;

const accept = 'application/graphql-response+json, application/json';

export function createGraphQLClient(
	options: GraphQLClientOptions,
): GraphQLClient {
	const { onUnauthenticated, retry: clientRetry, dedupe = true } = options;
	const { http, path } = transportOf(options);
	const flights = new Deduplicator();

	async function send(
		operation: Operation,
		variables: unknown,
		call: QueryOptions,
		retry: QueryRetry | undefined,
		signal: AbortSignal | undefined,
	): Promise<unknown> {
		const headers = new Headers(call.headers);
		if (!headers.has('accept')) headers.set('accept', accept);
		let reply: AnyReply;
		try {
			reply = await http.post(path, {
				json: {
					query: operation.query,
					variables: variables ?? {},
					operationName: operation.operationName,
				},
				headers,
				...(signal && { signal }),
				...(call.timeout !== undefined && { timeout: call.timeout }),
				...(retry !== undefined && { retry: retrySettings(retry) }),
				...(operation.operationName !== undefined && {
					operationId: operation.operationName,
				}),
			});
		} catch (error) {
			if (signal?.aborted) throw signal.reason;
			if (error instanceof TimeoutError)
				throw new ApiUnavailableError('timeout', { cause: error });
			if (error instanceof NetworkError)
				throw new ApiUnavailableError('unreachable', { cause: error });
			throw error;
		}
		return dataOf(reply);
	}

	async function run(
		document: AnyDocument,
		expected: Operation['kind'],
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
			if (expected === 'mutation')
				return await send(operation, variables, call, false, call.signal);
			const retry = call.retry ?? clientRetry;
			if (!dedupe)
				return await send(operation, variables, call, retry, call.signal);
			const key = JSON.stringify([
				operation.query,
				variables ?? {},
				[...new Headers(call.headers)],
				call.timeout,
				retry,
			]);
			return await flights.run(key, call.signal, (signal) =>
				send(operation, variables, call, retry, signal),
			);
		} catch (error) {
			if (
				onUnauthenticated &&
				(error instanceof ApiError || error instanceof ApiStatusError) &&
				error.status === 401
			) {
				onUnauthenticated(error);
			}
			throw error;
		}
	}

	return {
		query: (document, ...[variables, call]) =>
			run(document, 'query', variables, call) as Promise<never>,
		mutate: (document, ...[variables, call]) =>
			run(document, 'mutation', variables, call) as Promise<never>,
		http,
	};
}

function transportOf(options: GraphQLClientOptions): {
	http: HttpClient;
	path: string;
} {
	if (options.http)
		return { http: options.http, path: options.path ?? '/graphql' };
	const {
		url,
		onUnauthenticated: _hook,
		retry: _retry,
		dedupe: _dedupe,
		...transport
	} = options;
	return { http: createHttpClient({ ...transport, baseUrl: url }), path: '' };
}

/** httpyz retries no POST by default: a query's retries name it. */
function retrySettings(retry: QueryRetry): RetryOptions | false {
	if (retry === false) return false;
	if (typeof retry === 'number') return { attempts: retry, methods: ['post'] };
	return { ...retry, methods: ['post'] };
}

/** A response's `data`, or the error it stands for. */
function dataOf(reply: AnyReply): unknown {
	const body = isRecord(reply.data) ? reply.data : undefined;
	const errors = body?.['errors'];
	if (Array.isArray(errors) && errors.length > 0) {
		throw new ApiError(
			errors as ApiErrorEntry[],
			body?.['data'] ?? undefined,
			reply.status,
		);
	}
	if (reply.status < 200 || reply.status >= 300)
		throw new ApiStatusError(reply.status, reply.data);
	const data = body?.['data'];
	if (data == null) throw new ApiUnavailableError('invalid-response');
	return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
