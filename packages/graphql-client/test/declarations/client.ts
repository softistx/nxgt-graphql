// An application's client, calls and error handling, behind exported values
// whose types are inferred: a declaration build must be able to name each one
// through `@nxgt/graphql-client` and its peers alone (TS2883 otherwise).
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
	ApiError,
	type ApiErrorEntry,
	type ApiErrorExtensions,
	type ApiErrorParams,
	type ApiFieldError,
	ApiStatusError,
	ApiUnavailableError,
	type BatchOptions,
	type CacheKeys,
	CacheMissError,
	type CallOptions,
	createGraphQLClient,
	type EntityRef,
	type FetchPolicy,
	type FieldModifier,
	type FragmentOptions,
	type GraphQLCache,
	type GraphQLClient,
	type GraphQLClientOptions,
	type GraphQLDocument,
	type HttpClientBasedOptions,
	isApiError,
	type NormalizedCacheOptions,
	normalizedCache,
	type PersistedQueries,
	type PossibleTypes,
	type QueryOptions,
	type QueryRetry,
	type SubscribeOptions,
	type Subscription,
	type UnavailableReason,
	type UrlClientOptions,
	type VariablesArgs,
	type VariablesThen,
} from '@nxgt/graphql-client';
import { createHttpClient } from '@nxgt/httpyz';

type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

export const Viewer = {} as TypedDocumentNode<
	{ viewer: { id: string } },
	Exact<{ [key: string]: never }>
>;
export const Rename = {} as TypedDocumentNode<
	{ rename: boolean },
	Exact<{ name: string }>
>;

export const client = createGraphQLClient({
	url: 'https://api.example.com/graphql',
	retry: { attempts: 2 },
	onUnauthenticated: (error) => {
		if (error.status === 401) throw new Response(null, { status: 302 });
	},
});

export const overHttp = createGraphQLClient({
	http: createHttpClient({ baseUrl: 'https://api.example.com' }),
	path: '/graphql',
	dedupe: false,
	persisted: { mode: 'documentId' },
	batch: { max: 5, wait: 10 },
});

export const apq = createGraphQLClient({
	url: 'https://api.example.com/graphql',
	persisted: { mode: 'apq' },
	batch: false,
});

export const OnTick = {} as TypedDocumentNode<
	{ tick: number },
	Exact<{ room: string }>
>;

export const possibleTypes: PossibleTypes = { Node: ['User', 'Book'] };
export const keys: CacheKeys = { Book: (book) => String(book['isbn']) };
export const cacheOptions: NormalizedCacheOptions = { possibleTypes, keys };
export const cache = normalizedCache(cacheOptions);
export const cached = createGraphQLClient({
	url: 'https://api.example.com/graphql',
	cache,
});
export const policy: FetchPolicy = 'cache-first';
export const fromCache = cached.query(
	Viewer,
	{},
	{ fetchPolicy: 'cache-only' },
);
export const clientCache: GraphQLCache = cached.cache;
// Given a cache, `client.cache` needs no `!`.
export const cachedRead = cached.cache.read(Viewer);
export const typedCached: GraphQLClient<GraphQLCache> = cached;
export const cacheless: GraphQLClient<undefined> = client;
export const noCache: undefined = client.cache;
// Options whose `cache` the types cannot tell: either.
export const either = createGraphQLClient(options());
export const eitherCache: GraphQLCache | undefined = either.cache;
export function cacheRefusals() {
	// @ts-expect-error: a client created without a cache holds none
	client.cache.read(Viewer);
	// @ts-expect-error: nor may a client of either kind be read without a check
	either.cache.read(Viewer);
	// A wrong option, cache or not: no overload matches. A wrong type rather
	// than an unknown key: under nodenext, httpyz 0.3.3's declarations lose
	// `HttpClientOptions` (extensionless imports), so the `url` shape takes
	// any unknown key there, before 0.2.0 as after.
	// @ts-expect-error: `dedupe` is a boolean
	createGraphQLClient({ url: 'https://a.example', cache, dedupe: 'yes' });
	// @ts-expect-error: `dedupe` is a boolean
	createGraphQLClient({ url: 'https://a.example', dedupe: 'yes' });
}
export const read = cache.read(Viewer);
export const stop = cache.watch(Rename, { name: 'a' }, (data) => data?.rename);
export const ref: EntityRef = { __typename: 'Book', id: '1' };
export const renamed2 = cache.modify(ref, {
	title: ((title) => String(title)) satisfies FieldModifier,
});
export const BookCard = {} as TypedDocumentNode<{ title: string }, unknown>;
export const fragmentOptions: FragmentOptions = { fragmentName: 'BookCard' };
export const card = cache.readFragment(BookCard, ref, fragmentOptions);
export const stopCard = cache.watchFragment(BookCard, 'Book:1', (data) =>
	data?.title.toUpperCase(),
);
export const writeArgs: VariablesThen<{ name: string }, boolean> = [
	{ name: 'a' },
	true,
];
export const stopViewer = cache.watch(Viewer, (data) => data?.viewer.id);
export function writeViewer() {
	cache.write(Viewer, {}, { viewer: { id: 'u' } });
	cache.write(Viewer, { viewer: { id: 'u' } });
	// @ts-expect-error: Rename requires its variables
	cache.write(Rename, { rename: true });
	// @ts-expect-error: the data must have the document's shape
	cache.write(Viewer, { viewer: { id: 1 } });
	// @ts-expect-error: a variable the document does not declare
	cache.write(Rename, { name: 'a', extra: 1 }, { rename: true });
	cache.evict('User:u');
	cache.reset();
}

// What the cache's types refuse.
export function refusals() {
	// @ts-expect-error: Rename requires its variables
	cache.watch(Rename, (data) => data?.rename);
	// @ts-expect-error: a variable the document does not declare
	cache.watch(Rename, { name: 'a', extra: 1 }, (data) => data?.rename);
	cache.watchFragment(
		BookCard,
		'Book:1',
		// @ts-expect-error: the callback gets the fragment's data, not another shape
		(data: { pages: number } | undefined) => data?.pages,
	);
}

export const persisted: PersistedQueries = { mode: 'apq' };
export const batch: BatchOptions = { max: 10 };

export const viewer = client.query(Viewer);
export const renamed = client.mutate(Rename, { name: 'a' });
export const retried = client.query(Viewer, {}, { retry: false, timeout: 500 });

// execute: a query or a mutation, whichever the document holds.
export const executedQuery: Promise<{ viewer: { id: string } }> =
	client.execute(Viewer);
export const executedMutation = client.execute(
	Rename,
	{ name: 'a' },
	{ timeout: 500, headers: { 'x-a': 'b' } },
);
// A generic adapter forwarding any document, as a server-side route does.
export function forward<TResult, TVariables>(
	document: GraphQLDocument<TResult, TVariables>,
	...args: VariablesArgs<NoInfer<TVariables>, CallOptions>
): Promise<TResult> {
	return client.execute(document, ...args);
}
export const forwarded: Promise<{ rename: boolean }> = forward(Rename, {
	name: 'a',
});
export function executeRefusals() {
	// @ts-expect-error: Rename requires its variables
	client.execute(Rename);
	// @ts-expect-error: the options are what query and mutate both take
	client.execute(Viewer, {}, { fetchPolicy: 'network-only' });
	// @ts-expect-error: nor a query's retries: the types cannot tell a query
	client.execute(Viewer, {}, { retry: 1 });
}

export const ticks = client.subscribe(
	OnTick,
	{ room: 'a' },
	{ signal: AbortSignal.timeout(1000), headers: { 'x-room': 'a' } },
);
export const subscribeOptions: SubscribeOptions = { headers: {} };
export const subscription: Subscription<{ tick: number }> = ticks;

export async function lastTick() {
	let last: number | undefined;
	for await (const { tick } of ticks) last = tick;
	ticks.close();
	return last;
}

export function options(): GraphQLClientOptions {
	return { url: 'https://api.example.com' };
}
export const urlOptions: UrlClientOptions = { url: 'https://api.example.com' };
export const httpOptions: HttpClientBasedOptions = { http: client.http };
export const call: CallOptions = { timeout: 1 };
export const queryCall: QueryOptions = { retry: 1 };
export const retry: QueryRetry = false;
export const args: VariablesArgs<{ name: string }, CallOptions> = [
	{ name: 'a' },
];
export const typed: GraphQLClient = client;
export const typedCachedClient: GraphQLClient = cached;
// The last overload is the one `ReturnType` and `Parameters` read: as before.
export const returned: ReturnType<typeof createGraphQLClient> = cached;
export const parameters: Parameters<typeof createGraphQLClient>[0] = options();
export const statusError = new ApiStatusError(404, undefined, {
	statusText: 'Not Found',
	cause: new Error('x'),
});
export const bareStatusError = new ApiStatusError(503, 'down');
export const document: GraphQLDocument<{ ok: boolean }, never> | undefined =
	undefined;

// The errors and their guard, as an application's catch holds them.
export async function failure() {
	try {
		await client.query(Viewer);
	} catch (error) {
		if (isApiError(error)) {
			const entry: ApiErrorEntry | undefined = error.errors[0];
			const extensions: ApiErrorExtensions = error.extensions;
			const params: ApiErrorParams = error.params;
			const fields: readonly ApiFieldError[] = error.fields;
			return { entry, extensions, params, fields, code: error.code };
		}
		if (error instanceof ApiStatusError) {
			const statusText: string = error.statusText;
			return `${error.status} ${statusText}`;
		}
		if (error instanceof ApiUnavailableError) {
			const reason: UnavailableReason = error.reason;
			return reason;
		}
		if (error instanceof ApiError) return error.httpStatus;
		if (error instanceof CacheMissError) return error.operationName;
		throw error;
	}
	return undefined;
}
