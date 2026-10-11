import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { createGraphQLClient } from './client';
import { ApiError, ApiStatusError, ApiUnavailableError } from './errors';
import type { GraphQLClientOptions } from './options';

type Doc = TypedDocumentNode<Record<string, unknown>, { id?: string }>;
const doc = (text: string, hash?: string) =>
	Object.assign(parse(text), hash ? { __meta__: { hash } } : {}) as Doc;
const A = doc('query A($id: ID) { a(id: $id) }', 'hash-a');
const B = doc('query B { b }', 'hash-b');
const C = doc('query C { c }', 'hash-c');
const Rename = doc(
	'mutation Rename { rename }',
) as unknown as TypedDocumentNode<{ rename: boolean }, Record<string, never>>;

type Body = Record<string, unknown>;

/** The reply to one operation's body: `{ data: { <name>: <name> } }`. */
const answerOf = (body: Body) => {
	const name = String(body['operationName']);
	return { data: { [name.toLowerCase()]: name } };
};

/**
 * A fetch recording each request's body and signal. By default it answers
 * a plain body with its answer and an array with the array of answers.
 */
function server(
	answer: (body: Body | Body[]) => Response | Promise<Response> = (body) =>
		Response.json(Array.isArray(body) ? body.map(answerOf) : answerOf(body)),
) {
	const sent: (Body | Body[])[] = [];
	const signals: AbortSignal[] = [];
	const fetch = async (request: Request) => {
		const body = (await request.json()) as Body | Body[];
		sent.push(body);
		signals.push(request.signal);
		return answer(body);
	};
	return { fetch, sent, signals };
}

const url = 'https://api.test/graphql';
const clientOf = (
	api: ReturnType<typeof server>,
	options: Partial<GraphQLClientOptions> = {},
) =>
	createGraphQLClient({
		url,
		fetch: api.fetch,
		batch: {},
		...options,
	} as GraphQLClientOptions);

/** Waits until the fetch got `count` requests. */
async function requests(api: ReturnType<typeof server>, count: number) {
	while (api.sent.length < count) await Bun.sleep(1);
}

describe('batching', () => {
	test('queries issued together are posted as one array, each gets its entry', async () => {
		const api = server();
		const client = clientOf(api);
		const results = await Promise.all([
			client.query(A, { id: '1' }),
			client.query(B),
		]);
		expect(results).toEqual([{ a: 'A' }, { b: 'B' }]);
		expect(api.sent).toHaveLength(1);
		expect(api.sent[0]).toEqual([
			{ query: expect.any(String), variables: { id: '1' }, operationName: 'A' },
			{ query: expect.any(String), variables: {}, operationName: 'B' },
		]);
	});

	test('a batch of one is sent as a plain body', async () => {
		const api = server();
		const client = clientOf(api);
		expect(await client.query(B)).toEqual({ b: 'B' });
		expect(Array.isArray(api.sent[0])).toBe(false);
	});

	test('a mutation is sent alone', async () => {
		const api = server();
		const client = clientOf(api);
		await Promise.all([
			client.query(A),
			client.query(B),
			client.mutate(Rename),
		]);
		expect(api.sent).toHaveLength(2);
		const plain = api.sent.find((body) => !Array.isArray(body)) as Body;
		expect(plain['operationName']).toBe('Rename');
	});

	test('max splits the queries into batches', async () => {
		const api = server();
		const client = clientOf(api, { batch: { max: 2 } });
		const results = await Promise.all([
			client.query(A),
			client.query(B),
			client.query(C),
		]);
		expect(results).toEqual([{ a: 'A' }, { b: 'B' }, { c: 'C' }]);
		expect(api.sent).toHaveLength(2);
		expect(
			(api.sent[0] as Body[]).map((body) => body['operationName']),
		).toEqual(['A', 'B']);
		expect((api.sent[1] as Body)['operationName']).toBe('C');
	});

	test('wait collects queries issued within it', async () => {
		const api = server();
		const client = clientOf(api, { batch: { wait: 30 } });
		const a = client.query(A);
		await Bun.sleep(5);
		const b = client.query(B);
		await Promise.all([a, b]);
		expect(api.sent).toHaveLength(1);
		expect(api.sent[0]).toHaveLength(2);
	});

	test('different headers, timeout or retry are different batches', async () => {
		const api = server();
		const client = clientOf(api);
		await Promise.all([
			client.query(A, {}, { headers: { 'accept-language': 'en' } }),
			client.query(B, {}, { headers: { 'accept-language': 'fr' } }),
			client.query(C, {}, { timeout: 1_000 }),
		]);
		expect(api.sent).toHaveLength(3);
		expect(api.sent.every((body) => !Array.isArray(body))).toBe(true);
	});

	test('identical queries share one entry: dedupe stays above batching', async () => {
		const api = server();
		const client = clientOf(api);
		const results = await Promise.all([
			client.query(A, { id: '1' }),
			client.query(A, { id: '1' }),
			client.query(B),
		]);
		expect(results).toEqual([{ a: 'A' }, { a: 'A' }, { b: 'B' }]);
		expect(api.sent[0]).toHaveLength(2);
	});

	test('an entry with errors rejects alone, with the reply status', async () => {
		const api = server((body) =>
			Response.json([
				{ errors: [{ message: 'No A', extensions: { code: 'NOT_FOUND' } }] },
				answerOf((body as Body[])[1] as Body),
			]),
		);
		const client = clientOf(api);
		const [a, b] = await Promise.all([
			client.query(A).catch((e: unknown) => e),
			client.query(B),
		]);
		expect(a).toBeInstanceOf(ApiError);
		expect((a as ApiError).code).toBe('NOT_FOUND');
		expect((a as ApiError).httpStatus).toBe(200);
		expect(b).toEqual({ b: 'B' });
	});
});

describe('a reply that is not the batch', () => {
	const both = (
		options: Partial<GraphQLClientOptions>,
		api: ReturnType<typeof server>,
	) => {
		const client = clientOf(api, options);
		return Promise.all([
			client.query(A).catch((e: unknown) => e),
			client.query(B).catch((e: unknown) => e),
		]);
	};

	test('a 2xx object: every entry is an invalid response', async () => {
		const errors = await both(
			{},
			server(() => Response.json({ data: { a: 1 } })),
		);
		for (const error of errors) {
			expect(error).toBeInstanceOf(ApiUnavailableError);
			expect((error as ApiUnavailableError).reason).toBe('invalid-response');
		}
	});

	test('an array of another length: every entry is an invalid response', async () => {
		const errors = await both(
			{},
			server(() => Response.json([{ data: { a: 1 } }])),
		);
		for (const error of errors)
			expect((error as ApiUnavailableError).reason).toBe('invalid-response');
	});

	test('a non-2xx with no array: every entry gets its ApiStatusError', async () => {
		const errors = await both(
			{},
			server(() => new Response('Bad gateway', { status: 502 })),
		);
		for (const error of errors) {
			expect(error).toBeInstanceOf(ApiStatusError);
			expect((error as ApiStatusError).status).toBe(502);
		}
	});

	test('a non-2xx with a GraphQL error for the whole batch: every entry gets it', async () => {
		const errors = await both(
			{},
			server(() =>
				Response.json(
					{ errors: [{ message: 'Batching is not enabled' }] },
					{ status: 400 },
				),
			),
		);
		for (const error of errors) {
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).message).toBe('Batching is not enabled');
		}
	});

	test('an unreachable API: every entry is unreachable', async () => {
		const errors = await both(
			{},
			server(() => {
				throw new TypeError('fetch failed');
			}),
		);
		for (const error of errors)
			expect((error as ApiUnavailableError).reason).toBe('unreachable');
	});
});

describe('aborts', () => {
	/** A server held until `release()`, answering by default. */
	const held = () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const api = server(async (body) => {
			await gate;
			return Response.json(
				Array.isArray(body) ? body.map(answerOf) : answerOf(body),
			);
		});
		return { api, release: () => release() };
	};

	test('an entry aborted before the batch leaves is dropped from it', async () => {
		const api = server();
		const client = clientOf(api);
		const controller = new AbortController();
		const a = client.query(A, {}, { signal: controller.signal });
		const b = client.query(B);
		const reason = new Error('left');
		controller.abort(reason);
		expect(await a.catch((e: unknown) => e)).toBe(reason);
		expect(await b).toEqual({ b: 'B' });
		expect(api.sent).toEqual([
			{ query: expect.any(String), variables: {}, operationName: 'B' },
		]);
	});

	test('every entry aborted before the batch leaves: nothing is sent', async () => {
		const api = server();
		const client = clientOf(api);
		const controller = new AbortController();
		const a = client.query(A, {}, { signal: controller.signal }).catch(() => 1);
		const b = client.query(B, {}, { signal: controller.signal }).catch(() => 2);
		controller.abort();
		expect(await Promise.all([a, b])).toEqual([1, 2]);
		await Bun.sleep(5);
		expect(api.sent).toEqual([]);
	});

	test('a sent batch is aborted only once every entry left', async () => {
		const { api, release } = held();
		const client = clientOf(api);
		const first = new AbortController();
		const second = new AbortController();
		const a = client
			.query(A, {}, { signal: first.signal })
			.catch((e: unknown) => e);
		const b = client
			.query(B, {}, { signal: second.signal })
			.catch((e: unknown) => e);
		await requests(api, 1);
		const reason = new Error('first left');
		first.abort(reason);
		expect(await a).toBe(reason);
		expect(api.signals[0]?.aborted).toBe(false);
		second.abort();
		await b;
		expect(api.signals[0]?.aborted).toBe(true);
		release();
	});

	test('an entry that leaves a sent batch leaves the other its answer', async () => {
		const { api, release } = held();
		const client = clientOf(api);
		const controller = new AbortController();
		const a = client
			.query(A, {}, { signal: controller.signal })
			.catch((e: unknown) => e);
		const b = client.query(B);
		await requests(api, 1);
		controller.abort();
		await a;
		release();
		expect(await b).toEqual({ b: 'B' });
	});
});

describe('persisted queries in a batch', () => {
	const hashOf = (text: string) =>
		createHash('sha256').update(text).digest('hex');

	test('documentId: each entry carries its own', async () => {
		const api = server();
		const client = clientOf(api, { persisted: { mode: 'documentId' } });
		await Promise.all([client.query(A, { id: '1' }), client.query(B)]);
		expect(api.sent).toEqual([
			[
				{ documentId: 'hash-a', variables: { id: '1' }, operationName: 'A' },
				{ documentId: 'hash-b', variables: {}, operationName: 'B' },
			],
		]);
	});

	test('apq: each entry carries its hash; one not found is resent alone with its text', async () => {
		const notFound = {
			errors: [
				{
					message: 'PersistedQueryNotFound',
					extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
				},
			],
		};
		const api = server((body) =>
			Response.json(
				Array.isArray(body)
					? [notFound, answerOf(body[1] as Body)]
					: answerOf(body),
			),
		);
		const client = clientOf(api, { persisted: { mode: 'apq' } });
		const results = await Promise.all([client.query(A), client.query(B)]);
		expect(results).toEqual([{ a: 'A' }, { b: 'B' }]);
		expect(api.sent).toHaveLength(2);
		const [batch, resent] = api.sent as [Body[], Body];
		for (const body of batch) {
			expect(body['query']).toBeUndefined();
			expect(body['extensions']).toEqual({
				persistedQuery: { version: 1, sha256Hash: expect.any(String) },
			});
		}
		expect(resent['operationName']).toBe('A');
		expect(resent['extensions']).toEqual({
			persistedQuery: {
				version: 1,
				sha256Hash: hashOf(String(resent['query'])),
			},
		});
	});
});
