import { describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { createHttpClient, type Middleware } from '@nxgt/httpyz';
import { parse } from 'graphql';
import { createGraphQLClient } from './client';
import { ApiStatusError, ApiUnavailableError } from './errors';

const ViewerQuery = parse(
	'query Viewer { viewer { id } }',
) as TypedDocumentNode<{ viewer: { id: string } }, Record<string, never>>;
const TickSubscription = parse(
	'subscription Tick { tick }',
) as TypedDocumentNode<{ tick: number }, Record<string, never>>;

/**
 * An error shaped as another httpyz copy's: a plain `Error` of that name
 * with its fields, which this package's httpyz classes do not match by
 * `instanceof`.
 */
function lookAlike(name: string, fields: Record<string, unknown> = {}): Error {
	const error = new Error(`${name} from another httpyz copy`);
	error.name = name;
	return Object.assign(error, { method: 'POST', path: '/graphql' }, fields);
}

/** A client over an httpyz client whose middleware throws `error`. */
function clientThrowing(error: unknown) {
	const throwing: Middleware = async () => {
		throw error;
	};
	const http = createHttpClient({
		baseUrl: 'https://api.test',
		use: [throwing],
		fetch: () => new Response(null, { status: 500 }),
	});
	return createGraphQLClient({ http });
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	throw new Error('expected a rejection');
}

describe("another httpyz copy's errors, matched by name", () => {
	test('a bare Error named TimeoutError or NetworkError is left as it is', async () => {
		for (const name of ['TimeoutError', 'NetworkError']) {
			const thrown = new Error('no httpyz fields');
			thrown.name = name;
			const error = await rejection(clientThrowing(thrown).query(ViewerQuery));
			expect(error).toBe(thrown);
		}
	});

	test('a TimeoutError is ApiUnavailableError("timeout")', async () => {
		const thrown = lookAlike('TimeoutError', { timeout: 10 });
		const error = await rejection(clientThrowing(thrown).query(ViewerQuery));
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('timeout');
		expect((error as ApiUnavailableError).cause).toBe(thrown);
	});

	test('a NetworkError is ApiUnavailableError("unreachable")', async () => {
		const thrown = lookAlike('NetworkError');
		const error = await rejection(clientThrowing(thrown).query(ViewerQuery));
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('unreachable');
		expect((error as ApiUnavailableError).cause).toBe(thrown);
	});

	test("a response's ValidationError is mapped by its status", async () => {
		const failure = (status: number) => ({
			kind: 'response',
			method: 'POST',
			path: '/graphql',
			status,
			issues: [],
		});
		const refused = await rejection(
			clientThrowing(
				lookAlike('ValidationError', { failure: failure(502) }),
			).query(ViewerQuery),
		);
		expect(refused).toBeInstanceOf(ApiStatusError);
		expect((refused as ApiStatusError).status).toBe(502);
		const invalid = await rejection(
			clientThrowing(
				lookAlike('ValidationError', { failure: failure(200) }),
			).query(ViewerQuery),
		);
		expect(invalid).toBeInstanceOf(ApiUnavailableError);
		expect((invalid as ApiUnavailableError).reason).toBe('invalid-response');
	});

	test('a ValidationError with no readable failure is left as it is', async () => {
		const thrown = lookAlike('ValidationError', { failure: 'garbled' });
		const error = await rejection(clientThrowing(thrown).query(ViewerQuery));
		expect(error).toBe(thrown);
	});

	test('a refused stream is an ApiStatusError, its body read', async () => {
		const response = new Response('overloaded', {
			status: 503,
			headers: { 'content-type': 'text/plain' },
		});
		const thrown = lookAlike('UndeclaredStatusError', {
			status: 503,
			response,
		});
		const subscription = clientThrowing(thrown).subscribe(TickSubscription);
		const error = await rejection(
			(async () => {
				for await (const _ of subscription);
			})(),
		);
		expect(error).toBeInstanceOf(ApiStatusError);
		expect((error as ApiStatusError).status).toBe(503);
		expect((error as ApiStatusError).body).toBe('overloaded');
	});

	test('an UndeclaredStatusError without a response is left as it is', async () => {
		const thrown = lookAlike('UndeclaredStatusError', { status: 503 });
		const subscription = clientThrowing(thrown).subscribe(TickSubscription);
		const error = await rejection(
			(async () => {
				for await (const _ of subscription);
			})(),
		);
		expect(error).toBe(thrown);
	});

	test("the body-read deadline's DOMException is still a timeout", async () => {
		const thrown = new DOMException('The operation timed out.', 'TimeoutError');
		const error = await rejection(clientThrowing(thrown).query(ViewerQuery));
		expect(error).toBeInstanceOf(ApiUnavailableError);
		expect((error as ApiUnavailableError).reason).toBe('timeout');
	});

	test("a DOMException named NetworkError is not taken for httpyz's", async () => {
		const thrown = new DOMException('gone', 'NetworkError');
		const error = await rejection(clientThrowing(thrown).query(ViewerQuery));
		expect(error).toBe(thrown);
	});
});

describe("a caller's own deadline", () => {
	/** A fetch that never answers: it rejects when its request is aborted. */
	const hanging = (request: Request) =>
		new Promise<Response>((_, reject) => {
			request.signal.addEventListener('abort', () =>
				reject(request.signal.reason),
			);
		});

	test('a query rejects with the DOMException itself', async () => {
		const client = createGraphQLClient({
			url: 'https://api.test/graphql',
			fetch: hanging,
		});
		const signal = AbortSignal.timeout(20);
		const error = await rejection(client.query(ViewerQuery, {}, { signal }));
		expect(error).toBeInstanceOf(DOMException);
		expect(error).not.toBeInstanceOf(ApiUnavailableError);
		expect(error).toBe(signal.reason);
	});

	test('a batched query rejects with the DOMException itself', async () => {
		const client = createGraphQLClient({
			url: 'https://api.test/graphql',
			fetch: hanging,
			batch: {},
		});
		const signal = AbortSignal.timeout(20);
		const error = await rejection(client.query(ViewerQuery, {}, { signal }));
		expect(error).toBeInstanceOf(DOMException);
		expect(error).not.toBeInstanceOf(ApiUnavailableError);
		expect(error).toBe(signal.reason);
	});

	test('a subscription rejects with the DOMException itself', async () => {
		const client = createGraphQLClient({
			url: 'https://api.test/graphql',
			fetch: hanging,
		});
		const signal = AbortSignal.timeout(20);
		const error = await rejection(
			(async () => {
				for await (const _ of client.subscribe(
					TickSubscription,
					{},
					{ signal },
				));
			})(),
		);
		expect(error).toBeInstanceOf(DOMException);
		expect(error).not.toBeInstanceOf(ApiUnavailableError);
		expect(error).toBe(signal.reason);
	});
});
