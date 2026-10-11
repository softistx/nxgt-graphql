import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { createGraphQLClient } from './client';
import { ApiError, ApiStatusError, ApiUnavailableError } from './errors';

/**
 * Subscriptions against a real HTTP server: what a fetch double cannot
 * prove, such as a refused connection's body read before the request closes.
 */

type Tick = { tick: number };
const TickSubscription = parse(
	'subscription Tick { tick }',
) as TypedDocumentNode<Tick, Record<string, never>>;

const encoder = new TextEncoder();
const next = (result: unknown) =>
	`event: next\ndata: ${JSON.stringify(result)}\n\n`;
const complete = 'event: complete\ndata:\n\n';
const notFound = {
	errors: [
		{
			message: 'PersistedQueryNotFound',
			extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
		},
	],
};
/** graphql-yoga's SSE body for a result: a first comment, the result, complete. */
const yogaStream = (result: unknown) => `:\n\n${next(result)}${complete}`;

/** An event stream sending `chunks`, held open as a subscription's is. */
function eventStream(
	chunks: readonly string[],
	status = 200,
	onCancel = () => {},
) {
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
		},
		cancel: onCancel,
	});
	return new Response(body, {
		status,
		headers: { 'content-type': 'text/event-stream' },
	});
}

async function collect<T>(results: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = [];
	for await (const value of results) values.push(value);
	return values;
}

const caught = (pending: Promise<unknown>) =>
	pending.then(
		() => undefined,
		(error: unknown) => error,
	);

describe('subscribe against a real server', () => {
	const received: {
		path: string;
		accept: string | null;
		body: Record<string, unknown>;
	}[] = [];
	let ticksCancelled = false;
	let server: ReturnType<typeof Bun.serve>;

	const routes: Record<string, (body: Record<string, unknown>) => Response> = {
		'/ticks': () =>
			eventStream(
				[next({ data: { tick: 1 } }), next({ data: { tick: 2 } }), complete],
				200,
				() => {
					ticksCancelled = true;
				},
			),
		'/bad-request': () =>
			Response.json(
				{ errors: [{ message: 'Bad', extensions: { code: 'BAD' } }] },
				{ status: 400 },
			),
		'/bad-gateway': () => new Response('Bad gateway', { status: 502 }),
		// graphql-yoga's useAPQ() default: the error as a 404 event stream.
		'/apq-default': () =>
			new Response(yogaStream(notFound), {
				status: 404,
				headers: { 'content-type': 'text/event-stream' },
			}),
		// useAPQ({ responseConfig: { forceStatusCodeOk: true } }).
		'/apq-forced': (body) =>
			eventStream([
				body['query'] === undefined
					? yogaStream(notFound)
					: yogaStream({ data: { tick: 7 } }),
			]),
	};

	beforeAll(() => {
		server = Bun.serve({
			port: 0,
			async fetch(request) {
				const { pathname } = new URL(request.url);
				const body = (await request.json()) as Record<string, unknown>;
				received.push({
					path: pathname,
					accept: request.headers.get('accept'),
					body,
				});
				const route = routes[pathname];
				return route ? route(body) : new Response(null, { status: 404 });
			},
		});
	});

	afterAll(() => {
		server.stop(true);
	});

	const clientOf = (path: string, apq = false) =>
		createGraphQLClient({
			url: new URL(path, server.url),
			...(apq && { persisted: { mode: 'apq' as const } }),
		});

	test('yields each next, ends on complete, and closes the connection', async () => {
		const results = await collect(
			clientOf('/ticks').subscribe(TickSubscription),
		);
		expect(results).toEqual([{ tick: 1 }, { tick: 2 }]);
		expect(received.at(-1)?.accept).toBe('text/event-stream');
		await Bun.sleep(10);
		expect(ticksCancelled).toBe(true);
	});

	test('a JSON 400 carrying GraphQL errors throws an ApiError', async () => {
		const error = await caught(
			collect(clientOf('/bad-request').subscribe(TickSubscription)),
		);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).code).toBe('BAD');
		expect((error as ApiError).status).toBe(400);
	});

	test('a text 502 throws ApiStatusError, its body the text', async () => {
		const error = await caught(
			collect(clientOf('/bad-gateway').subscribe(TickSubscription)),
		);
		expect(error).toBeInstanceOf(ApiStatusError);
		expect((error as ApiStatusError).status).toBe(502);
		expect((error as ApiStatusError).body).toBe('Bad gateway');
	});

	test('a 404 event stream throws ApiStatusError(404), its body the raw text; apq does not resend', async () => {
		const before = received.length;
		const error = await caught(
			collect(clientOf('/apq-default', true).subscribe(TickSubscription)),
		);
		expect(error).toBeInstanceOf(ApiStatusError);
		expect((error as ApiStatusError).status).toBe(404);
		expect((error as ApiStatusError).body).toBe(yogaStream(notFound));
		expect(received.length - before).toBe(1);
	});

	test('apq: PersistedQueryNotFound as the first event of a 200 stream is resent once, with the text', async () => {
		const before = received.length;
		const results = await collect(
			clientOf('/apq-forced', true).subscribe(TickSubscription),
		);
		expect(results).toEqual([{ tick: 7 }]);
		const [first, second, ...rest] = received.slice(before);
		expect(rest).toEqual([]);
		expect(first?.body['query']).toBeUndefined();
		expect(second?.body['query']).toBe('subscription Tick {\n  tick\n}');
	});
});

describe('a dropped connection against a real server', () => {
	let server: ReturnType<typeof Bun.serve> | undefined;

	afterAll(() => {
		server?.stop(true);
	});

	test('rejects the loop with ApiUnavailableError("unreachable") after what it yielded', async () => {
		server = Bun.serve({
			port: 0,
			fetch: () => eventStream([next({ data: { tick: 1 } })]),
		});
		const client = createGraphQLClient({ url: server.url });
		const seen: unknown[] = [];
		const error = await caught(
			(async () => {
				for await (const tick of client.subscribe(TickSubscription)) {
					seen.push(tick);
					// Every connection cut, as a restarting server does.
					server?.stop(true);
				}
			})(),
		);
		expect(seen).toEqual([{ tick: 1 }]);
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('unreachable');
	});
});
