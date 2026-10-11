/**
 * What the React specs share: a GraphQL server as a `fetch` double, whose
 * answers a spec can hold back, and a wrapper giving a hook its client.
 */
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { createElement, type ReactNode, StrictMode } from 'react';
import type { GraphQLClient } from '../src/options';
import { GraphQLProvider } from '../src/react/context';

export type Book = { __typename: 'Book'; id: string; title: string };

export const BookQuery = parse(
	'query Book($id: ID!) { book(id: $id) { id title } }',
) as TypedDocumentNode<{ book: Book }, { id: string }>;

export const RenameMutation = parse(
	'mutation Rename($id: ID!, $title: String!) { rename(id: $id, title: $title) { id title } }',
) as TypedDocumentNode<{ rename: Book }, { id: string; title: string }>;

export const BookCard = parse(
	'fragment BookCard on Book { id title }',
) as TypedDocumentNode<{ id: string; title: string }, unknown>;

export const url = 'https://api.test/graphql';

export const book = (title: string, id = '1'): Book => ({
	__typename: 'Book',
	id,
	title,
});

/** One request the double received: its body, its signal, and how to answer it. */
export interface Received {
	readonly body: {
		readonly operationName: string;
		readonly variables: Record<string, unknown>;
	};
	readonly signal: AbortSignal;
	readonly headers: Headers;
	answer(result: unknown): void;
}

/**
 * A server answering `{ data: answer(body) }` at once, or, with `hold`,
 * only when the spec calls `received[i].answer(...)`. A held request
 * rejects as a real fetch does when its signal aborts.
 */
export function server(
	answer: (body: Received['body']) => unknown = () => ({}),
	{ hold = false } = {},
) {
	const received: Received[] = [];
	const fetch = async (request: Request): Promise<Response> => {
		const body = (await request.json()) as Received['body'];
		const { promise, resolve, reject } = Promise.withResolvers<Response>();
		const { signal } = request;
		received.push({
			body,
			signal,
			headers: request.headers,
			answer: (result) => resolve(Response.json(result)),
		});
		if (signal.aborted) reject(signal.reason);
		signal.addEventListener('abort', () => reject(signal.reason));
		if (!hold) resolve(Response.json({ data: answer(body) }));
		return promise;
	};
	return { fetch, received };
}

/** The `wrapper` of `renderHook`: the client, and StrictMode when asked. */
export function withClient(client: GraphQLClient, { strict = false } = {}) {
	return ({ children }: { children: ReactNode }) => {
		const provided = createElement(GraphQLProvider, { client }, children);
		return strict ? createElement(StrictMode, null, provided) : provided;
	};
}

/** Lets the promises already settled run their callbacks. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export const TickSubscription = parse(
	'subscription Tick($room: ID!) { tick(room: $room) }',
) as TypedDocumentNode<{ tick: number }, { room: string }>;

/** One event stream the double opened: push `next` results, complete it, or see it closed. */
export interface Stream {
	readonly variables: Record<string, unknown>;
	readonly signal: AbortSignal;
	next(result: unknown): void;
	complete(): void;
}

/**
 * A graphql-sse server in distinct connections mode: each subscription is
 * one event stream the spec writes to, errored when its request is aborted
 * as a real fetch's body is.
 */
export function eventServer() {
	const streams: Stream[] = [];
	const encoder = new TextEncoder();
	const fetch = async (request: Request): Promise<Response> => {
		const { variables } = (await request.json()) as Stream['variables'];
		const { signal } = request;
		let push!: ReadableStreamDefaultController<Uint8Array>;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				push = controller;
			},
		});
		const send = (text: string) => push.enqueue(encoder.encode(text));
		signal.addEventListener('abort', () => {
			try {
				push.error(signal.reason);
			} catch {}
		});
		streams.push({
			variables: variables as Record<string, unknown>,
			signal,
			next: (result) =>
				send(`event: next\ndata: ${JSON.stringify(result)}\n\n`),
			complete: () => {
				send('event: complete\ndata:\n\n');
				push.close();
			},
		});
		return new Response(body, {
			headers: { 'content-type': 'text/event-stream' },
		});
	};
	return { fetch, streams };
}
