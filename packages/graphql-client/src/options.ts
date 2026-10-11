import type { HttpClient, HttpClientOptions, RetryOptions } from '@nxgt/httpyz';
import type { GraphQLDocument } from './document';
import type { ApiError, ApiStatusError } from './errors';

/** A query's retries: always over POST, which is how GraphQL is sent. */
export type QueryRetry = number | Omit<RetryOptions, 'methods'> | false;

interface CommonOptions {
	/**
	 * Runs when the API answers 401: the HTTP status, after httpyz's
	 * `auth.refresh` was tried and did not save the call, or a GraphQL error's
	 * `extensions.http.status` on any HTTP status, for which no refresh is
	 * tried. What it throws, such as a redirect, is what the caller gets;
	 * when it returns, the caller gets the `ApiError` or `ApiStatusError`.
	 * It runs once per caller, deduplicated callers included.
	 */
	onUnauthenticated?: (
		error: ApiError | ApiStatusError,
	) => void | Promise<void>;
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
		// NoInfer: the document alone sets the variables' type, so an extra key is refused.
		...args: VariablesArgs<NoInfer<TVariables>, QueryOptions>
	): Promise<TResult>;
	/** Runs a mutation and returns its `data`; any GraphQL error throws. It is never retried. */
	mutate<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: VariablesArgs<NoInfer<TVariables>, CallOptions>
	): Promise<TResult>;
	/** The transport, for what is not GraphQL. */
	readonly http: HttpClient;
}
