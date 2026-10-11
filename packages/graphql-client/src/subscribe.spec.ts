import { describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { createGraphQLClient } from './client';
import { ApiError, ApiStatusError, ApiUnavailableError } from './errors';

type Tick = { tick: number };
const TickSubscription = parse(
	'subscription Tick { tick }',
) as TypedDocumentNode<Tick, Record<string, never>>;
const RoomSubscription = parse(
	'subscription Room($room: ID!) { message(room: $room) }',
) as TypedDocumentNode<{ message: string }, { room: string }>;
const ViewerQuery = parse(
	'query Viewer { viewer { id } }',
) as TypedDocumentNode<{ viewer: { id: string } }, Record<string, never>>;
const RenameMutation = parse(
	'mutation Rename($name: String!) { rename(name: $name) }',
) as TypedDocumentNode<{ rename: boolean }, { name: string }>;

const url = 'https://api.test/graphql';
const next = (result: unknown) =>
	`event: next\ndata: ${JSON.stringify(result)}\n\n`;
const complete = 'event: complete\ndata:\n\n';

/**
 * An event stream sending `chunks`, then ending, or held open as a
 * subscription's is; it records whether its reader cancelled it.
 */
function eventStream(chunks: readonly string[], { open = false } = {}) {
	let cancelled = false;
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			if (!open) controller.close();
		},
		cancel() {
			cancelled = true;
		},
	});
	const response = new Response(body, {
		headers: { 'content-type': 'text/event-stream' },
	});
	return { response, cancelled: () => cancelled };
}

/** Statuses whose response may hold no body. */
const nullBody = new Set([101, 103, 204, 205, 304]);

/**
 * `response` as a real fetch gives it: its body errors once the request's
 * signal aborts, so a double cannot pass where a body read after the
 * request closed fails.
 */
function abortable(request: Request, response: Response): Response {
	if (nullBody.has(response.status)) return response;
	const { signal } = request;
	const source = (response.body ?? new Blob([]).stream()).getReader();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const abort = () => {
				try {
					controller.error(signal.reason);
				} catch {}
				source.cancel(signal.reason).catch(() => {});
			};
			if (signal.aborted) abort();
			else signal.addEventListener('abort', abort, { once: true });
		},
		async pull(controller) {
			try {
				const chunk = await source.read();
				if (chunk.done) controller.close();
				else controller.enqueue(chunk.value);
			} catch (error) {
				try {
					controller.error(error);
				} catch {}
			}
		},
		cancel: (reason) => source.cancel(reason),
	});
	const { status, statusText, headers } = response;
	return new Response(body, { status, statusText, headers });
}

/** A fetch answering each request in turn, recording what it was sent. */
function server(...answers: (() => Response | Promise<Response>)[]) {
	const sent: { request: Request; body: Record<string, unknown> }[] = [];
	const fetch = async (request: Request) => {
		const body = (await request.clone().json()) as Record<string, unknown>;
		sent.push({ request, body });
		const answer = answers[sent.length - 1] ?? answers.at(-1);
		if (!answer) throw new Error('No answer');
		return abortable(request, await answer());
	};
	return { fetch, sent };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function collect<T>(results: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = [];
	for await (const value of results) values.push(value);
	return values;
}

describe('subscribe', () => {
	test('posts the operation for an event stream, yields each next, and ends on complete', async () => {
		const stream = eventStream(
			[next({ data: { tick: 1 } }), next({ data: { tick: 2 } }), complete],
			{ open: true },
		);
		const api = server(() => stream.response);
		const client = createGraphQLClient({ url, fetch: api.fetch });
		expect(await collect(client.subscribe(TickSubscription))).toEqual([
			{ tick: 1 },
			{ tick: 2 },
		]);
		const [{ request, body }] = api.sent as [(typeof api.sent)[0]];
		expect(request.method).toBe('POST');
		expect(request.url).toBe(url);
		expect(request.headers.get('accept')).toBe('text/event-stream');
		expect(body).toEqual({
			query: 'subscription Tick {\n  tick\n}',
			variables: {},
			operationName: 'Tick',
		});
		expect(stream.cancelled()).toBe(true);
	});

	test('connects on the first iteration only, with its variables and headers', async () => {
		const api = server(() => eventStream([complete]).response);
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const messages = client.subscribe(
			RoomSubscription,
			{ room: 'r1' },
			{ headers: { 'x-room': 'r1' } },
		);
		await Bun.sleep(1);
		expect(api.sent).toHaveLength(0);
		expect(await collect(messages)).toEqual([]);
		expect(api.sent[0]?.body['variables']).toEqual({ room: 'r1' });
		expect(api.sent[0]?.request.headers.get('x-room')).toBe('r1');
	});

	test("asks for an event stream over a client-level accept; the call's own accept wins", async () => {
		const api = server(() => eventStream([complete]).response);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			headers: { accept: 'application/json' },
		});
		await collect(client.subscribe(TickSubscription));
		await collect(
			client.subscribe(
				TickSubscription,
				{},
				{ headers: { accept: 'text/event-stream; q=1' } },
			),
		);
		expect(api.sent[0]?.request.headers.get('accept')).toBe(
			'text/event-stream',
		);
		expect(api.sent[1]?.request.headers.get('accept')).toBe(
			'text/event-stream; q=1',
		);
	});

	test('unknown events and comments are ignored; the stream ending ends the loop', async () => {
		const stream = eventStream([
			': keep-alive\n\n',
			'event: ping\ndata: {}\n\n',
			next({ data: { tick: 1 } }),
			'data: no event name\n\n',
		]);
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
		});
		expect(await collect(client.subscribe(TickSubscription))).toEqual([
			{ tick: 1 },
		]);
	});

	test('is read once', () => {
		const client = createGraphQLClient({
			url,
			fetch: server(() => eventStream([complete]).response).fetch,
		});
		const ticks = client.subscribe(TickSubscription);
		ticks[Symbol.asyncIterator]();
		expect(() => ticks[Symbol.asyncIterator]()).toThrow(
			new TypeError('A subscription is read once'),
		);
	});

	test('subscribe() refuses a query and a mutation, before anything is sent', () => {
		const api = server(() => eventStream([complete]).response);
		const client = createGraphQLClient({ url, fetch: api.fetch });
		expect(() => client.subscribe(ViewerQuery as never)).toThrow(
			new TypeError('subscribe() was given a query'),
		);
		expect(() =>
			client.subscribe(RenameMutation as never, { name: 'a' } as never),
		).toThrow(new TypeError('subscribe() was given a mutation'));
		expect(api.sent).toHaveLength(0);
	});

	test('mutate() refuses a subscription', async () => {
		const client = createGraphQLClient({ url, fetch: () => json({}) });
		await expect(client.mutate(TickSubscription as never)).rejects.toThrow(
			new TypeError('mutate() was given a subscription'),
		);
	});
});

describe('errors in the stream', () => {
	test('a next carrying errors throws an ApiError with its data, and closes the stream', async () => {
		const stream = eventStream(
			[
				next({ data: { tick: 1 } }),
				next({
					data: { tick: null },
					errors: [{ message: 'Boom', extensions: { code: 'BOOM' } }],
				}),
				next({ data: { tick: 3 } }),
			],
			{ open: true },
		);
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
		});
		const seen: unknown[] = [];
		const error = await (async () => {
			for await (const tick of client.subscribe(TickSubscription))
				seen.push(tick);
		})().catch((caught: unknown) => caught);
		expect(seen).toEqual([{ tick: 1 }]);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).code).toBe('BOOM');
		expect((error as ApiError).data).toEqual({ tick: null });
		expect(stream.cancelled()).toBe(true);
	});

	test('a next whose data is not JSON throws ApiUnavailableError("invalid-response")', async () => {
		const client = createGraphQLClient({
			url,
			fetch: server(
				() => eventStream(['event: next\ndata: {oops\n\n']).response,
			).fetch,
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('invalid-response');
	});

	test('a 2xx that is not an event stream throws ApiUnavailableError("invalid-response")', async () => {
		const client = createGraphQLClient({
			url,
			fetch: server(() => json({ data: { tick: 1 } })).fetch,
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect((error as ApiUnavailableError).reason).toBe('invalid-response');
	});

	test('a GraphQL-level 401 in a next runs the hook', async () => {
		const seen: unknown[] = [];
		const client = createGraphQLClient({
			url,
			fetch: server(
				() =>
					eventStream([
						next({
							errors: [
								{
									message: 'Signed out',
									extensions: { http: { status: 401 } },
								},
							],
						}),
					]).response,
			).fetch,
			onUnauthenticated: (error) => {
				seen.push(error);
			},
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiError);
		expect(seen).toEqual([error]);
	});
	test('a next 401 runs the hook once, though more events follow', async () => {
		let calls = 0;
		const stream = eventStream(
			[
				next({
					errors: [
						{ message: 'Signed out', extensions: { http: { status: 401 } } },
					],
				}),
				next({ data: { tick: 2 } }),
			],
			{ open: true },
		);
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
			onUnauthenticated: () => {
				calls++;
			},
		});
		const seen: unknown[] = [];
		const error = await (async () => {
			for await (const tick of client.subscribe(TickSubscription))
				seen.push(tick);
		})().catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ApiError);
		expect(seen).toEqual([]);
		expect(calls).toBe(1);
		expect(stream.cancelled()).toBe(true);
	});
});

describe('closing', () => {
	test('close() ends the loop and cancels the stream', async () => {
		const stream = eventStream([next({ data: { tick: 1 } })], { open: true });
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
		});
		const ticks = client.subscribe(TickSubscription);
		const seen: unknown[] = [];
		const loop = (async () => {
			for await (const tick of ticks) {
				seen.push(tick);
				setTimeout(() => ticks.close(), 5);
			}
		})();
		await loop;
		expect(seen).toEqual([{ tick: 1 }]);
		expect(stream.cancelled()).toBe(true);
	});

	test('close() before the first iteration sends nothing', async () => {
		const api = server(() => eventStream([complete]).response);
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const ticks = client.subscribe(TickSubscription);
		ticks.close();
		expect(await collect(ticks)).toEqual([]);
		expect(api.sent).toHaveLength(0);
	});

	test('close() while next() is pending resolves it done, and cancels the stream', async () => {
		const stream = eventStream([next({ data: { tick: 1 } })], { open: true });
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
		});
		const ticks = client.subscribe(TickSubscription);
		const iterator = ticks[Symbol.asyncIterator]();
		expect(await iterator.next()).toEqual({ done: false, value: { tick: 1 } });
		const pending = iterator.next();
		await Bun.sleep(1);
		ticks.close();
		expect(await pending).toEqual({ done: true, value: undefined });
		expect(stream.cancelled()).toBe(true);
	});

	test('a throw inside the loop rejects with it and cancels the stream', async () => {
		const stream = eventStream([next({ data: { tick: 1 } })], { open: true });
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
		});
		const mine = new Error('render failed');
		const loop = (async () => {
			for await (const _ of client.subscribe(TickSubscription)) throw mine;
		})();
		await expect(loop).rejects.toBe(mine);
		expect(stream.cancelled()).toBe(true);
	});

	test('break cancels the stream', async () => {
		const stream = eventStream(
			[next({ data: { tick: 1 } }), next({ data: { tick: 2 } })],
			{ open: true },
		);
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
		});
		for await (const tick of client.subscribe(TickSubscription)) {
			expect(tick).toEqual({ tick: 1 });
			break;
		}
		expect(stream.cancelled()).toBe(true);
	});

	test('an abort rejects the loop with its reason and cancels the stream', async () => {
		const stream = eventStream([next({ data: { tick: 1 } })], { open: true });
		const client = createGraphQLClient({
			url,
			fetch: server(() => stream.response).fetch,
		});
		const controller = new AbortController();
		const reason = new Error('left the page');
		const seen: unknown[] = [];
		const loop = (async () => {
			for await (const tick of client.subscribe(
				TickSubscription,
				{},
				{ signal: controller.signal },
			)) {
				seen.push(tick);
				setTimeout(() => controller.abort(reason), 5);
			}
		})();
		await expect(loop).rejects.toBe(reason);
		expect(seen).toEqual([{ tick: 1 }]);
		expect(stream.cancelled()).toBe(true);
	});

	test('a signal aborted already rejects with its reason, and sends nothing', async () => {
		const api = server(() => eventStream([complete]).response);
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const reason = new Error('gone');
		const ticks = client.subscribe(
			TickSubscription,
			{},
			{ signal: AbortSignal.abort(reason) },
		);
		await expect(collect(ticks)).rejects.toBe(reason);
		expect(api.sent).toHaveLength(0);
	});
});

describe('connect failures', () => {
	test('a non-2xx with GraphQL errors throws an ApiError', async () => {
		const client = createGraphQLClient({
			url,
			fetch: server(() =>
				json(
					{ errors: [{ message: 'Bad', extensions: { code: 'BAD' } }] },
					400,
				),
			).fetch,
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).code).toBe('BAD');
		expect((error as ApiError).status).toBe(400);
	});

	test('a non-2xx with a text body throws ApiStatusError, its body the text', async () => {
		const client = createGraphQLClient({
			url,
			fetch: server(() => new Response('Bad gateway', { status: 502 })).fetch,
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiStatusError);
		expect((error as ApiStatusError).status).toBe(502);
		expect((error as ApiStatusError).body).toBe('Bad gateway');
	});

	test('a 401 runs the hook, awaited; what it throws is what the loop gets', async () => {
		const order: string[] = [];
		const redirect = new Response(null, { status: 302 });
		const client = createGraphQLClient({
			url,
			fetch: server(() => new Response(null, { status: 401 })).fetch,
			onUnauthenticated: async (error) => {
				await Bun.sleep(1);
				order.push(`hook ${error.status}`);
				throw redirect;
			},
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => {
				order.push('caught');
				return caught;
			},
		);
		expect(error).toBe(redirect);
		expect(order).toEqual(['hook 401', 'caught']);
	});

	test('a 401 without a hook throws ApiStatusError(401)', async () => {
		const client = createGraphQLClient({
			url,
			fetch: server(() => new Response(null, { status: 401 })).fetch,
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect((error as ApiStatusError).status).toBe(401);
	});

	test('an unreachable API throws ApiUnavailableError("unreachable"), never retried', async () => {
		let calls = 0;
		const client = createGraphQLClient({
			url,
			retry: { attempts: 3 },
			fetch: () => {
				calls++;
				throw new TypeError('fetch failed');
			},
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('unreachable');
		expect(calls).toBe(1);
	});

	test('a 503 is never retried', async () => {
		const api = server(() => new Response(null, { status: 503 }));
		const client = createGraphQLClient({
			url,
			retry: { attempts: 3 },
			fetch: api.fetch,
		});
		await expect(collect(client.subscribe(TickSubscription))).rejects.toThrow(
			ApiStatusError,
		);
		expect(api.sent).toHaveLength(1);
	});
});

describe('persisted subscriptions', () => {
	const hashed = Object.assign(parse('subscription Tick { tick }'), {
		__meta__: { hash: 'tick-hash' },
	}) as TypedDocumentNode<Tick, Record<string, never>>;
	const notFound = {
		errors: [
			{
				message: 'PersistedQueryNotFound',
				extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
			},
		],
	};

	test('documentId mode posts the hash, without the text', async () => {
		const api = server(() => eventStream([complete]).response);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'documentId' },
		});
		await collect(client.subscribe(hashed));
		expect(api.sent[0]?.body).toEqual({
			documentId: 'tick-hash',
			variables: {},
			operationName: 'Tick',
		});
	});

	test('documentId mode refuses a document with no hash, before anything is sent', () => {
		const api = server(() => eventStream([complete]).response);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'documentId' },
		});
		expect(() => client.subscribe(TickSubscription)).toThrow(TypeError);
		expect(api.sent).toHaveLength(0);
	});

	test('apq mode posts the hash; not found, it connects once more with the text', async () => {
		const api = server(
			() => eventStream([next(notFound), complete]).response,
			() => eventStream([next({ data: { tick: 1 } }), complete]).response,
		);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
		});
		expect(await collect(client.subscribe(TickSubscription))).toEqual([
			{ tick: 1 },
		]);
		const [first, second] = api.sent;
		expect(first?.body['query']).toBeUndefined();
		expect(first?.body['extensions']).toEqual({
			persistedQuery: { version: 1, sha256Hash: expect.any(String) },
		});
		expect(second?.body['query']).toBe('subscription Tick {\n  tick\n}');
		expect(second?.body['extensions']).toEqual(first?.body['extensions']);
	});

	test('apq mode against graphql-yoga with forceStatusCodeOk: a 200 stream not found is sent once more, exactly once', async () => {
		// What useAPQ({ responseConfig: { forceStatusCodeOk: true } }) sends.
		const api = server(
			() => eventStream([':\n\n', next(notFound), complete]).response,
		);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).message).toBe('PersistedQueryNotFound');
		expect(api.sent).toHaveLength(2);
		expect(api.sent[1]?.body['query']).toBe('subscription Tick {\n  tick\n}');
	});

	test("apq mode against graphql-yoga's default 404 event stream: ApiStatusError(404), its raw text, no resend", async () => {
		const text = `:\n\n${next(notFound)}${complete}`;
		const api = server(
			() =>
				new Response(text, {
					status: 404,
					headers: { 'content-type': 'text/event-stream' },
				}),
		);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
		});
		const error = await collect(client.subscribe(TickSubscription)).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiStatusError);
		expect((error as ApiStatusError).status).toBe(404);
		expect((error as ApiStatusError).body).toBe(text);
		expect(api.sent).toHaveLength(1);
	});

	test('apq mode: not found after data was yielded is never sent again', async () => {
		const api = server(
			() => eventStream([next({ data: { tick: 1 } }), next(notFound)]).response,
		);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
		});
		const seen: unknown[] = [];
		const error = await (async () => {
			for await (const tick of client.subscribe(TickSubscription))
				seen.push(tick);
		})().catch((caught: unknown) => caught);
		expect(seen).toEqual([{ tick: 1 }]);
		expect((error as ApiError).message).toBe('PersistedQueryNotFound');
		expect(api.sent).toHaveLength(1);
	});
});

describe('types', () => {
	test('variables are checked, and each result is typed', async () => {
		const client = createGraphQLClient({
			url,
			fetch: server(
				() =>
					eventStream([next({ data: { message: 'hi' } }), complete]).response,
			).fetch,
		});
		// @ts-expect-error: `room` is required
		client.subscribe(RoomSubscription);
		// @ts-expect-error: a subscription is never retried
		client.subscribe(TickSubscription, {}, { retry: 2 });
		// @ts-expect-error: a subscription's options take no timeout
		client.subscribe(TickSubscription, {}, { timeout: 1000 });
		// @ts-expect-error: `extra` is not a variable of the operation
		client.subscribe(RoomSubscription, { room: 'a', extra: 1 });
		for await (const result of client.subscribe(RoomSubscription, {
			room: 'a',
		})) {
			const message: string = result.message;
			// @ts-expect-error: the result has no `tick`
			result.tick;
			expect(message).toBe('hi');
		}
	});
});
