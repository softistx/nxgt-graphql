// An application's components and hooks, behind exported values whose types
// are inferred: a declaration build must be able to name each one through
// `@nxgt/graphql-client/react`, the root entry and react's own types alone
// (TS2883 otherwise). No JSX: the consumer's tsconfig here sets none.
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { createGraphQLClient, normalizedCache } from '@nxgt/graphql-client';
import {
	GraphQLProvider,
	type GraphQLProviderProps,
	type MutateFunction,
	type MutationState,
	type QueryResult,
	type SubscriptionState,
	type UseQueryOptions,
	type UseSubscriptionOptions,
	useClient,
	useFragment,
	useMutation,
	useQuery,
	useSubscription,
} from '@nxgt/graphql-client/react';
import { createElement, type ReactNode } from 'react';

type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

export const BookQuery = {} as TypedDocumentNode<
	{ book: { __typename: 'Book'; id: string; title: string } | null },
	Exact<{ id: string }>
>;
export const ViewerQuery = {} as TypedDocumentNode<
	{ viewer: { id: string } },
	Exact<{ [key: string]: never }>
>;
export const Rename = {} as TypedDocumentNode<
	{ rename: { id: string; title: string } },
	Exact<{ id: string; title: string }>
>;
export const OnTick = {} as TypedDocumentNode<
	{ tick: number },
	Exact<{ room: string }>
>;
export const BookCard = {} as TypedDocumentNode<
	{ id: string; title: string },
	unknown
>;

export const client = createGraphQLClient({
	url: 'https://api.example.com/graphql',
	cache: normalizedCache(),
});

export const providerProps: GraphQLProviderProps = { client };
export const App = (props: { children?: ReactNode }) =>
	createElement(GraphQLProvider, { client }, props.children);

export function useBook(id: string) {
	const options: UseQueryOptions = { fetchPolicy: 'cache-first' };
	const query = useQuery(BookQuery, { id }, options);
	const viewer = useQuery(ViewerQuery);
	const typed: QueryResult<{ viewer: { id: string } }> = viewer;
	return { title: query.data?.book?.title, viewer: typed, query };
}

export function useRename() {
	const [rename, state] = useMutation(Rename);
	const mutate: MutateFunction<
		{ rename: { id: string; title: string } },
		Exact<{ id: string; title: string }>
	> = rename;
	const mutation: MutationState<{ rename: { id: string; title: string } }> =
		state;
	return { mutate, mutation, again: () => rename({ id: '1', title: 'x' }) };
}

export function useTicks(room: string) {
	const options: UseSubscriptionOptions<{ tick: number }> = {
		onData: ({ tick }) => tick,
	};
	const ticks: SubscriptionState<{ tick: number }> = useSubscription(
		OnTick,
		{ room },
		options,
	);
	return ticks;
}

export function useCard(id: string | undefined) {
	const card = useFragment(BookCard, id ? `Book:${id}` : undefined);
	return { card, client: useClient() };
}

// What the hooks' types refuse.
export function useRefusals() {
	// @ts-expect-error: BookQuery requires its variables
	useQuery(BookQuery);
	// @ts-expect-error: a variable the document does not declare
	useQuery(BookQuery, { id: '1', extra: 1 });
	// @ts-expect-error: id is a string
	useQuery(BookQuery, { id: 1 });
	const [rename] = useMutation(Rename);
	// @ts-expect-error: Rename requires a title
	rename({ id: '1' });
	// @ts-expect-error: OnTick requires its room
	useSubscription(OnTick);
	useSubscription(
		OnTick,
		{ room: 'a' },
		// @ts-expect-error: onData gets the subscription's data
		{ onData: (data: { other: string }) => data.other },
	);
	// @ts-expect-error: the fragment's data has no pages
	useFragment(BookCard, 'Book:1')?.pages;
}
