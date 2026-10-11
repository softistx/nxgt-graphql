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
	type CallOptions,
	createGraphQLClient,
	type GraphQLClient,
	type GraphQLClientOptions,
	type GraphQLDocument,
	type HttpClientBasedOptions,
	isApiError,
	type PersistedQueries,
	type QueryOptions,
	type QueryRetry,
	type UnavailableReason,
	type UrlClientOptions,
	type VariablesArgs,
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

export const persisted: PersistedQueries = { mode: 'apq' };
export const batch: BatchOptions = { max: 10 };

export const viewer = client.query(Viewer);
export const renamed = client.mutate(Rename, { name: 'a' });
export const retried = client.query(Viewer, {}, { retry: false, timeout: 500 });

export const options: GraphQLClientOptions = { url: 'https://api.example.com' };
export const urlOptions: UrlClientOptions = { url: 'https://api.example.com' };
export const httpOptions: HttpClientBasedOptions = { http: client.http };
export const call: CallOptions = { timeout: 1 };
export const queryCall: QueryOptions = { retry: 1 };
export const retry: QueryRetry = false;
export const args: VariablesArgs<{ name: string }, CallOptions> = [
	{ name: 'a' },
];
export const typed: GraphQLClient = client;
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
		if (error instanceof ApiStatusError) return error.status;
		if (error instanceof ApiUnavailableError) {
			const reason: UnavailableReason = error.reason;
			return reason;
		}
		if (error instanceof ApiError) return error.httpStatus;
		throw error;
	}
	return undefined;
}
