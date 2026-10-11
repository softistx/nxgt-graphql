export type { BatchOptions } from './batch';
export { normalizedCache } from './cache/normalized-cache';
export type {
	CacheKeys,
	EntityRef,
	FieldModifier,
	GraphQLCache,
	NormalizedCacheOptions,
	PossibleTypes,
} from './cache/types';
export { createGraphQLClient } from './client';
export type { GraphQLDocument } from './document';
export {
	ApiError,
	type ApiErrorEntry,
	type ApiErrorExtensions,
	type ApiErrorParams,
	type ApiFieldError,
	ApiStatusError,
	ApiUnavailableError,
	CacheMissError,
	isApiError,
	type UnavailableReason,
} from './errors';
export type { FetchPolicy } from './fetch-policy';
export type {
	CallOptions,
	GraphQLClient,
	GraphQLClientOptions,
	HttpClientBasedOptions,
	QueryOptions,
	QueryRetry,
	SubscribeOptions,
	Subscription,
	UrlClientOptions,
	VariablesArgs,
} from './options';
export type { PersistedQueries } from './persisted';
