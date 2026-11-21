import { describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { normalizedCache } from './cache/normalized-cache';
import { createGraphQLClient } from './client';
import { ApiError, ApiStatusError } from './errors';

type Viewer = { viewer: { id: string } };
const ViewerQuery = parse(
	'query Viewer { viewer { id } }',
) as TypedDocumentNode<Viewer, { id?: string }>;
const RenameMutation = parse('mutation Rename { rename }') as TypedDocumentNode<
	{ rename: boolean },
	Record<string, never>
>;

const url = 'https://api.test/graphql';

/** A fetch answering with the reply `answer` builds, its headers set from the request's `x-n`. */
const api = (answer: (n: string) => Response) => {
	let requests = 0;
	const fetch = async (request: Request) => {
		requests++;
		return answer(request.headers.get('x-n') ?? '');
	};
	return { fetch, count: () => requests };
};

const reply = (
	n: string,
	body: unknown = { data: { viewer: { id: 'u' } } },
	status = 200,
) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'x-request-id': `r${n}` },
	});

describe('onResponse', () => {
	test('execute reads the response headers of its own call', async () => {
		const server = api((n) => reply(n));
		const client = createGraphQLClient({ url, fetch: server.fetch });
		let id = '';
		const data = await client.execute(ViewerQuery, undefined, {
			onResponse: (response) => {
				id = response.headers.get('x-request-id') ?? '';
			},
		});
		expect(data).toEqual({ viewer: { id: 'u' } });
		expect(id).toBe('r');
	});

	test('a mutation gets its response too', async () => {
		const server = api((n) => reply(n, { data: { rename: true } }));
		const client = createGraphQLClient({ url, fetch: server.fetch });
		let status = 0;
		await client.mutate(RenameMutation, undefined, {
			onResponse: (response) => {
				status = response.status;
			},
		});
		expect(status).toBe(200);
	});

	test('concurrent identical queries each get their own response', async () => {
		const server = api((n) => reply(n));
		const client = createGraphQLClient({ url, fetch: server.fetch });
		const seen: Record<string, string | null> = {};
		const call = (n: string) =>
			client.query(ViewerQuery, undefined, {
				headers: { 'x-n': n },
				onResponse: (response) => {
					seen[n] = response.headers.get('x-request-id');
				},
			});
		await Promise.all([call('1'), call('2')]);
		expect(seen).toEqual({ '1': 'r1', '2': 'r2' });
	});

	test('a call with onResponse is never merged with an identical one', async () => {
		const server = api((n) => reply(n));
		const client = createGraphQLClient({ url, fetch: server.fetch });
		const seen: string[] = [];
		const onResponse = (response: Response) => {
			seen.push(response.headers.get('x-request-id') ?? '');
		};
		await Promise.all([
			client.query(ViewerQuery, undefined, { onResponse }),
			client.query(ViewerQuery, undefined, { onResponse }),
			client.query(ViewerQuery),
		]);
		expect(seen).toHaveLength(2);
		expect(server.count()).toBe(3);
	});

	test('it is not batched with other queries', async () => {
		const server = api((n) => reply(n));
		const client = createGraphQLClient({
			url,
			fetch: server.fetch,
			batch: { max: 5 },
		});
		let called = 0;
		await client.query(ViewerQuery, undefined, { onResponse: () => called++ });
		expect(called).toBe(1);
	});

	test('it runs before the ApiError of a refused call, so Retry-After is readable', async () => {
		const server = api(
			() =>
				new Response(JSON.stringify({ errors: [{ message: 'slow down' }] }), {
					status: 429,
					headers: { 'content-type': 'application/json', 'retry-after': '7' },
				}),
		);
		const client = createGraphQLClient({ url, fetch: server.fetch });
		let retryAfter = '';
		const error = await client
			.execute(ViewerQuery, undefined, {
				onResponse: (response) => {
					retryAfter = response.headers.get('retry-after') ?? '';
				},
			})
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(retryAfter).toBe('7');
	});

	test('a non-GraphQL refusal reaches it too', async () => {
		const server = api(
			() =>
				new Response('busy', { status: 503, headers: { 'retry-after': '3' } }),
		);
		const client = createGraphQLClient({ url, fetch: server.fetch });
		let retryAfter = '';
		const error = await client
			.execute(ViewerQuery, undefined, {
				onResponse: (response) => {
					retryAfter = response.headers.get('retry-after') ?? '';
				},
			})
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiStatusError);
		expect(retryAfter).toBe('3');
	});

	test('an error it throws rejects the call', async () => {
		const server = api((n) => reply(n));
		const client = createGraphQLClient({ url, fetch: server.fetch });
		const boom = new Error('boom');
		const error = await client
			.execute(ViewerQuery, undefined, {
				onResponse: () => {
					throw boom;
				},
			})
			.catch((e: unknown) => e);
		expect(error).toBe(boom);
	});

	test('with retries it runs once, with the final response', async () => {
		let attempts = 0;
		const fetch = async () => {
			attempts++;
			return attempts === 1
				? reply('1', { errors: [{ message: 'down' }] }, 503)
				: reply('2');
		};
		const client = createGraphQLClient({
			url,
			fetch,
			retry: { attempts: 1, delay: () => 0 },
		});
		const seen: number[] = [];
		await client.query(ViewerQuery, undefined, {
			onResponse: (response) => {
				seen.push(response.status);
			},
		});
		expect(attempts).toBe(2);
		expect(seen).toEqual([200]);
	});

	test('it is not called when nothing answered', async () => {
		const fetch = async () => {
			throw new TypeError('network down');
		};
		const client = createGraphQLClient({ url, fetch });
		let called = 0;
		const error = await client
			.query(ViewerQuery, undefined, { onResponse: () => called++ })
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(Error);
		expect(called).toBe(0);
	});

	test('it is not called for a result served from the cache', async () => {
		const server = api((n) =>
			reply(n, { data: { viewer: { __typename: 'User', id: 'u' } } }),
		);
		const client = createGraphQLClient({
			url,
			fetch: server.fetch,
			cache: normalizedCache(),
		});
		await client.query(ViewerQuery);
		let called = 0;
		await client.query(ViewerQuery, undefined, { onResponse: () => called++ });
		expect(server.count()).toBe(1);
		expect(called).toBe(0);
	});
});
