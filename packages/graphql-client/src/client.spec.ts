import { describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { createHttpClient } from '@nxgt/httpyz';
import { parse } from 'graphql';
import { createGraphQLClient } from './client.js';
import {
	ApiError,
	ApiStatusError,
	ApiUnavailableError,
	isApiError,
} from './errors.js';

type Viewer = { viewer: { id: string } };
const ViewerQuery = parse(
	'query Viewer { viewer { id } }',
) as TypedDocumentNode<Viewer, Record<string, never>>;
const RenameMutation = parse(
	'mutation Rename($name: String!) { rename(name: $name) }',
) as TypedDocumentNode<{ rename: boolean }, { name: string }>;

/** A fetch answering each request with `answer`, recording what it was sent. */
function server(
	answer: (
		request: Request,
		body: Record<string, unknown>,
	) => Response | Promise<Response>,
) {
	const sent: { request: Request; body: Record<string, unknown> }[] = [];
	const fetch = async (request: Request) => {
		const body = (await request.clone().json()) as Record<string, unknown>;
		sent.push({ request, body });
		return answer(request, body);
	};
	return { fetch, sent };
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});

const url = 'https://api.test/graphql';

describe('query and mutate', () => {
	test('a query posts its text, variables and name, and returns data', async () => {
		const api = server(() => json({ data: { viewer: { id: 'u1' } } }));
		const client = createGraphQLClient({ url, fetch: api.fetch });
		expect(await client.query(ViewerQuery)).toEqual({ viewer: { id: 'u1' } });
		const [{ request, body }] = api.sent as [(typeof api.sent)[0]];
		expect(request.method).toBe('POST');
		expect(request.url).toBe(url);
		expect(request.headers.get('accept')).toBe(
			'application/graphql-response+json, application/json',
		);
		expect(body).toEqual({
			query: 'query Viewer {\n  viewer {\n    id\n  }\n}',
			variables: {},
			operationName: 'Viewer',
		});
	});

	test('a TypedDocumentString is sent as written', async () => {
		const api = server(() => json({ data: { rename: true } }));
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const text = 'mutation Rename($name: String!) { rename(name: $name) }';
		const document = Object.assign(
			new String(text),
			{},
		) as unknown as TypedDocumentNode<{ rename: boolean }, { name: string }>;
		expect(await client.mutate(document, { name: 'a' })).toEqual({
			rename: true,
		});
		expect(api.sent[0]?.body).toEqual({
			query: text,
			variables: { name: 'a' },
			operationName: 'Rename',
		});
	});

	test('per-call headers go over the client headers', async () => {
		const api = server(() => json({ data: { viewer: { id: 'u1' } } }));
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			headers: { 'x-client': 'app', 'accept-language': 'en' },
		});
		await client.query(
			ViewerQuery,
			{},
			{ headers: { 'accept-language': 'fr' } },
		);
		const headers = api.sent[0]?.request.headers;
		expect(headers?.get('x-client')).toBe('app');
		expect(headers?.get('accept-language')).toBe('fr');
	});

	test('over an existing httpyz client, the path defaults to /graphql', async () => {
		const api = server(() => json({ data: { viewer: { id: 'u1' } } }));
		const client = createGraphQLClient({
			http: createHttpClient({ baseUrl: 'https://api.test', fetch: api.fetch }),
		});
		await client.query(ViewerQuery);
		expect(api.sent[0]?.request.url).toBe('https://api.test/graphql');
	});

	test('query() refuses a mutation, mutate() a query', async () => {
		const client = createGraphQLClient({ url, fetch: () => json({}) });
		await expect(client.query(RenameMutation as never)).rejects.toThrow(
			'query() was given a mutation',
		);
		await expect(client.mutate(ViewerQuery)).rejects.toThrow(
			'mutate() was given a query',
		);
	});
});

describe('errors', () => {
	test('GraphQL errors throw an ApiError with every extension', async () => {
		const extensions = {
			code: 'validation.errors.invalid-input',
			http: { status: 400 },
			fields: [
				{ path: 'ids.3', code: 'records.errors.archived', message: 'Archived' },
			],
			params: { max: 3 },
			retryAfter: 30,
		};
		const client = createGraphQLClient({
			url,
			fetch: () =>
				json(
					{
						errors: [{ message: 'Invalid input', extensions }],
						data: { partial: 1 },
					},
					400,
				),
		});
		const error = await client.query(ViewerQuery).catch((e: unknown) => e);
		expect(isApiError(error)).toBe(true);
		const api = error as ApiError;
		expect(api.message).toBe('Invalid input');
		expect(api.code).toBe('validation.errors.invalid-input');
		expect(api.status).toBe(400);
		expect(api.fields).toEqual(extensions.fields);
		expect(api.params).toEqual({ max: 3 });
		expect(api.extensions['retryAfter']).toBe(30);
		expect(api.data).toEqual({ partial: 1 });
	});

	test('a 200 with errors takes its status from extensions.http.status', async () => {
		const client = createGraphQLClient({
			url,
			fetch: () =>
				json({
					errors: [
						{
							message: 'Forbidden',
							extensions: { code: 'FORBIDDEN', http: { status: 403 } },
						},
					],
					data: null,
				}),
		});
		const error = (await client
			.query(ViewerQuery)
			.catch((e: unknown) => e)) as ApiError;
		expect(error.status).toBe(403);
		expect(error.httpStatus).toBe(200);
	});

	test("graphql-validation's issues become fields with dotted paths", async () => {
		const issues = [
			{
				path: ['input', 'address', 'zip'],
				message: 'Too short',
				code: 'too_small',
				constraint: 'minLength',
			},
		];
		const client = createGraphQLClient({
			url,
			fetch: () =>
				json({
					errors: [
						{
							message: 'Invalid arguments',
							extensions: { code: 'BAD_USER_INPUT', issues },
						},
					],
				}),
		});
		const error = (await client
			.query(ViewerQuery)
			.catch((e: unknown) => e)) as ApiError;
		expect(error.fields).toEqual([
			{ path: 'input.address.zip', code: 'too_small', message: 'Too short' },
		]);
	});

	test('a status with no GraphQL body throws an ApiStatusError', async () => {
		const client = createGraphQLClient({
			url,
			fetch: () => new Response('Not found', { status: 404 }),
		});
		const error = await client.query(ViewerQuery).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiStatusError);
		expect((error as ApiStatusError).status).toBe(404);
		expect((error as ApiStatusError).body).toBe('Not found');
	});

	test('a success with neither data nor errors is an invalid response', async () => {
		const client = createGraphQLClient({ url, fetch: () => json({}) });
		const error = await client.query(ViewerQuery).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('invalid-response');
	});

	test('an unreachable API throws ApiUnavailableError("unreachable")', async () => {
		const client = createGraphQLClient({
			url,
			fetch: () => {
				throw new TypeError('fetch failed');
			},
		});
		const error = await client.query(ViewerQuery).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('unreachable');
	});

	test('a timeout throws ApiUnavailableError("timeout")', async () => {
		const client = createGraphQLClient({
			url,
			timeout: 10,
			fetch: (request) =>
				new Promise<Response>((_, reject) =>
					request.signal.addEventListener('abort', () =>
						reject(request.signal.reason),
					),
				),
		});
		const error = await client.query(ViewerQuery).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('timeout');
	});

	test("an abort rejects with the signal's reason", async () => {
		const controller = new AbortController();
		const client = createGraphQLClient({
			url,
			fetch: (request) =>
				new Promise<Response>((_, reject) =>
					request.signal.addEventListener('abort', () =>
						reject(request.signal.reason),
					),
				),
		});
		const pending = client.query(
			ViewerQuery,
			{},
			{ signal: controller.signal },
		);
		const reason = new Error('left');
		controller.abort(reason);
		expect(await pending.catch((e: unknown) => e)).toBe(reason);
	});
});

describe('onUnauthenticated', () => {
	const redirect = new Response(null, {
		status: 302,
		headers: { location: '/sign-in' },
	});

	test('a bare 401 runs the hook, and what it throws reaches the caller', async () => {
		const client = createGraphQLClient({
			url,
			fetch: () => new Response(null, { status: 401 }),
			onUnauthenticated: () => {
				throw redirect;
			},
		});
		expect(await client.query(ViewerQuery).catch((e: unknown) => e)).toBe(
			redirect,
		);
	});

	test('a GraphQL 401 runs the hook too', async () => {
		let seen: unknown;
		const client = createGraphQLClient({
			url,
			fetch: () =>
				json({
					errors: [
						{
							message: 'Signed out',
							extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
						},
					],
				}),
			onUnauthenticated: (error) => {
				seen = error;
			},
		});
		const error = await client.query(ViewerQuery).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(seen).toBe(error);
	});

	test('without a hook, a 401 surfaces as the error', async () => {
		const client = createGraphQLClient({
			url,
			fetch: () =>
				json({
					errors: [
						{
							message: 'Wrong password',
							extensions: {
								code: 'auth.errors.invalid-credentials',
								http: { status: 401 },
							},
						},
					],
				}),
		});
		const error = (await client
			.mutate(RenameMutation, { name: 'a' })
			.catch((e: unknown) => e)) as ApiError;
		expect(error.code).toBe('auth.errors.invalid-credentials');
	});

	test("httpyz's refresh runs first: a saved call never reaches the hook", async () => {
		let token = 'old';
		let hooked = false;
		const client = createGraphQLClient({
			url,
			fetch: (request) =>
				request.headers.get('authorization') === 'Bearer new'
					? json({ data: { viewer: { id: 'u1' } } })
					: new Response(null, { status: 401 }),
			auth: {
				token: () => token,
				refresh: () => {
					token = 'new';
				},
			},
			onUnauthenticated: () => {
				hooked = true;
			},
		});
		expect(await client.query(ViewerQuery)).toEqual({ viewer: { id: 'u1' } });
		expect(hooked).toBe(false);
	});
});

describe('retries', () => {
	const flaky = () => {
		let calls = 0;
		const fetch = () =>
			++calls === 1
				? new Response(null, { status: 503 })
				: json({ data: { viewer: { id: 'u1' } } });
		return { fetch, calls: () => calls };
	};

	test('a query is retried over POST', async () => {
		const api = flaky();
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			retry: { attempts: 1, delay: () => 0 },
		});
		expect(await client.query(ViewerQuery)).toEqual({ viewer: { id: 'u1' } });
		expect(api.calls()).toBe(2);
	});

	test('a mutation is never retried', async () => {
		const api = flaky();
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			retry: { attempts: 1, delay: () => 0 },
		});
		await expect(
			client.mutate(RenameMutation, { name: 'a' }),
		).rejects.toBeInstanceOf(ApiStatusError);
		expect(api.calls()).toBe(1);
	});

	test('a mutation over an httpyz client that retries POST is still sent once', async () => {
		const api = flaky();
		const http = createHttpClient({
			baseUrl: 'https://api.test',
			fetch: api.fetch,
			retry: { attempts: 1, methods: ['post'], delay: () => 0 },
		});
		const client = createGraphQLClient({ http });
		await expect(
			client.mutate(RenameMutation, { name: 'a' }),
		).rejects.toBeInstanceOf(ApiStatusError);
		expect(api.calls()).toBe(1);
	});
});

describe('dedupe', () => {
	/** A fetch held until `release()`. */
	const held = () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		let calls = 0;
		const fetch = async (request: Request) => {
			calls++;
			await Promise.race([
				gate,
				new Promise((_, reject) =>
					request.signal.addEventListener('abort', () =>
						reject(request.signal.reason),
					),
				),
			]);
			return json({ data: { viewer: { id: 'u1' } } });
		};
		return { fetch, release: () => release(), calls: () => calls };
	};

	test('identical queries in flight share one request', async () => {
		const api = held();
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const both = Promise.all([
			client.query(ViewerQuery),
			client.query(ViewerQuery),
		]);
		api.release();
		expect(await both).toEqual([
			{ viewer: { id: 'u1' } },
			{ viewer: { id: 'u1' } },
		]);
		expect(api.calls()).toBe(1);
	});

	test('different headers are different requests', async () => {
		const api = held();
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const both = Promise.all([
			client.query(ViewerQuery, {}, { headers: { 'accept-language': 'en' } }),
			client.query(ViewerQuery, {}, { headers: { 'accept-language': 'fr' } }),
		]);
		api.release();
		await both;
		expect(api.calls()).toBe(2);
	});

	test("one caller's abort leaves the other waiting", async () => {
		const api = held();
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const controller = new AbortController();
		const left = client.query(ViewerQuery, {}, { signal: controller.signal });
		const stays = client.query(ViewerQuery);
		const reason = new Error('left');
		controller.abort(reason);
		expect(await left.catch((e: unknown) => e)).toBe(reason);
		api.release();
		expect(await stays).toEqual({ viewer: { id: 'u1' } });
		expect(api.calls()).toBe(1);
	});

	test('the shared request is aborted once every caller left, and the next one starts afresh', async () => {
		const api = held();
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const first = new AbortController();
		const second = new AbortController();
		const a = client
			.query(ViewerQuery, {}, { signal: first.signal })
			.catch((e: unknown) => e);
		const b = client
			.query(ViewerQuery, {}, { signal: second.signal })
			.catch((e: unknown) => e);
		while (api.calls() === 0) await Bun.sleep(1);
		first.abort();
		second.abort();
		await Promise.all([a, b]);
		const again = client.query(ViewerQuery);
		api.release();
		expect(await again).toEqual({ viewer: { id: 'u1' } });
		expect(api.calls()).toBe(2);
	});

	test('mutations are never shared', async () => {
		const api = held();
		const client = createGraphQLClient({ url, fetch: api.fetch });
		const both = Promise.all([
			client.mutate(RenameMutation, { name: 'a' }),
			client.mutate(RenameMutation, { name: 'a' }),
		]);
		api.release();
		await both;
		expect(api.calls()).toBe(2);
	});

	test('dedupe: false sends each query', async () => {
		const api = held();
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			dedupe: false,
		});
		const both = Promise.all([
			client.query(ViewerQuery),
			client.query(ViewerQuery),
		]);
		api.release();
		await both;
		expect(api.calls()).toBe(2);
	});
});

describe('types', () => {
	test('variables are required when the operation requires some, and the result is typed', async () => {
		const client = createGraphQLClient({
			url,
			fetch: () => json({ data: { rename: true } }),
		});
		// @ts-expect-error: `name` is required
		await client.mutate(RenameMutation).catch(() => undefined);
		// @ts-expect-error: `name` is a string
		await client.mutate(RenameMutation, { name: 1 }).catch(() => undefined);
		const result: { rename: boolean } = await client.mutate(RenameMutation, {
			name: 'a',
		});
		expect(result.rename).toBe(true);
	});
});
