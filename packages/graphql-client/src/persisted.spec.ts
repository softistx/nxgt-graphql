import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { createGraphQLClient } from './client';
import { operationOf } from './document';
import { ApiError } from './errors';
import {
	bodyOf,
	isPersistedQueryNotFound,
	missingHash,
	sha256Hex,
	sha256Of,
} from './persisted';

type Viewer = { viewer: { id: string } };
const text = 'query Viewer { viewer { id } }';
const RenameText = 'mutation Rename($name: String!) { rename(name: $name) }';

/** As the client preset writes a document under `persistedDocuments`. */
const withMeta = <T extends object>(document: T, hash: string) =>
	Object.assign(document, { __meta__: { hash } });

const ViewerQuery = withMeta(parse(text), 'viewer-hash') as TypedDocumentNode<
	Viewer,
	Record<string, never>
>;

/** Like the preset's `TypedDocumentString`, `__meta__` on the instance. */
class TypedDocumentString extends String {
	constructor(
		private readonly value: string,
		public __meta__?: Record<string, unknown>,
	) {
		super(value);
	}
	override toString(): string {
		return this.value;
	}
}

/** A fetch answering each request with `answer`, recording each body. */
function server(answer: (body: Record<string, unknown>) => Response) {
	const sent: Record<string, unknown>[] = [];
	const fetch = async (request: Request) => {
		const body = (await request.json()) as Record<string, unknown>;
		sent.push(body);
		return answer(body);
	};
	return { fetch, sent };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const url = 'https://api.test/graphql';
const notFound = {
	errors: [
		{
			message: 'PersistedQueryNotFound',
			extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
		},
	],
};

describe('sha256', () => {
	test('a known string', async () => {
		expect(await sha256Hex('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		);
	});

	test('of the exact text sent, computed once per operation', async () => {
		const operation = operationOf(new TypedDocumentString(text) as never);
		expect(sha256Of(operation)).toBe(sha256Of(operation));
		expect(await sha256Of(operation)).toBe(
			createHash('sha256').update(text).digest('hex'),
		);
	});
});

describe('bodyOf', () => {
	const operation = operationOf(ViewerQuery as never);

	test('false: the text', async () => {
		expect(await bodyOf(operation, undefined, false)).toEqual({
			query: operation.query,
			variables: {},
			operationName: 'Viewer',
		});
	});

	test('documentId: the hash, no text', async () => {
		expect(await bodyOf(operation, { a: 1 }, { mode: 'documentId' })).toEqual({
			documentId: 'viewer-hash',
			variables: { a: 1 },
			operationName: 'Viewer',
		});
	});

	test('apq: the extension, no text', async () => {
		expect(await bodyOf(operation, {}, { mode: 'apq' })).toEqual({
			variables: {},
			operationName: 'Viewer',
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash: createHash('sha256')
						.update(operation.query)
						.digest('hex'),
				},
			},
		});
	});
});

describe('isPersistedQueryNotFound', () => {
	const apq = { mode: 'apq' } as const;
	const error = (message: string, code?: string) =>
		new ApiError([{ message, extensions: code ? { code } : {} }], null, 200);

	test('by its code or its message, in apq mode only', () => {
		expect(
			isPersistedQueryNotFound(apq, error('x', 'PERSISTED_QUERY_NOT_FOUND')),
		).toBe(true);
		expect(isPersistedQueryNotFound(apq, error('PersistedQueryNotFound'))).toBe(
			true,
		);
		expect(isPersistedQueryNotFound(apq, error('Other', 'OTHER'))).toBe(false);
		expect(
			isPersistedQueryNotFound(apq, new Error('PersistedQueryNotFound')),
		).toBe(false);
		expect(
			isPersistedQueryNotFound(
				{ mode: 'documentId' },
				error('PersistedQueryNotFound'),
			),
		).toBe(false);
		expect(
			isPersistedQueryNotFound(false, error('PersistedQueryNotFound')),
		).toBe(false);
	});
});

describe('documentId mode', () => {
	test('a DocumentNode is sent by its hash, without its text', async () => {
		const api = server(() => json({ data: { viewer: { id: 'u1' } } }));
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'documentId' },
		});
		expect(await client.query(ViewerQuery)).toEqual({ viewer: { id: 'u1' } });
		expect(api.sent).toEqual([
			{ documentId: 'viewer-hash', variables: {}, operationName: 'Viewer' },
		]);
	});

	test('a TypedDocumentString too, mutations included', async () => {
		const api = server(() => json({ data: { rename: true } }));
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'documentId' },
		});
		const Rename = new TypedDocumentString(RenameText, {
			hash: 'rename-hash',
		}) as unknown as TypedDocumentNode<{ rename: boolean }, { name: string }>;
		await client.mutate(Rename, { name: 'a' });
		expect(api.sent).toEqual([
			{
				documentId: 'rename-hash',
				variables: { name: 'a' },
				operationName: 'Rename',
			},
		]);
	});

	test('a document with no hash throws a TypeError, and nothing is sent', async () => {
		const api = server(() => json({ data: {} }));
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'documentId' },
		});
		const bare = parse(text) as TypedDocumentNode<
			Viewer,
			Record<string, never>
		>;
		await expect(client.query(bare)).rejects.toThrow(
			new TypeError(missingHash),
		);
		expect(missingHash).toBe(
			'The document carries no persisted hash: enable persistedDocuments in the client preset',
		);
		expect(api.sent).toEqual([]);
	});
});

describe('apq mode', () => {
	const hashOf = (query: string) =>
		createHash('sha256').update(query).digest('hex');

	test('a known hash: one request, without the text', async () => {
		const api = server(() => json({ data: { viewer: { id: 'u1' } } }));
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
		});
		const document = new TypedDocumentString(
			text,
		) as unknown as typeof ViewerQuery;
		expect(await client.query(document)).toEqual({ viewer: { id: 'u1' } });
		expect(api.sent).toEqual([
			{
				variables: {},
				operationName: 'Viewer',
				extensions: {
					persistedQuery: { version: 1, sha256Hash: hashOf(text) },
				},
			},
		]);
	});

	test('PersistedQueryNotFound: sent once more with the text and the same extensions', async () => {
		const api = server((body) =>
			body['query'] ? json({ data: { viewer: { id: 'u1' } } }) : json(notFound),
		);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
		});
		expect(await client.query(ViewerQuery)).toEqual({ viewer: { id: 'u1' } });
		const query = operationOf(ViewerQuery as never).query;
		expect(api.sent).toHaveLength(2);
		expect(api.sent[1]).toEqual({
			query,
			variables: {},
			operationName: 'Viewer',
			extensions: { persistedQuery: { version: 1, sha256Hash: hashOf(query) } },
		});
	});

	test('a mutation not found is sent once more, exactly once', async () => {
		const api = server(() => json(notFound));
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
			retry: { attempts: 3, delay: () => 0 },
		});
		const Rename = new TypedDocumentString(
			RenameText,
		) as unknown as TypedDocumentNode<{ rename: boolean }, { name: string }>;
		const error = await client
			.mutate(Rename, { name: 'a' })
			.catch((e: unknown) => e);
		expect((error as ApiError).code).toBe('PERSISTED_QUERY_NOT_FOUND');
		expect(api.sent).toHaveLength(2);
		expect(api.sent[0]?.['query']).toBeUndefined();
		expect(api.sent[1]?.['query']).toBe(RenameText);
	});

	test('a mutation that ran is never sent again', async () => {
		const api = server(() =>
			json({ errors: [{ message: 'Taken', extensions: { code: 'TAKEN' } }] }),
		);
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
		});
		const Rename = new TypedDocumentString(
			RenameText,
		) as unknown as TypedDocumentNode<{ rename: boolean }, { name: string }>;
		await expect(client.mutate(Rename, { name: 'a' })).rejects.toBeInstanceOf(
			ApiError,
		);
		expect(api.sent).toHaveLength(1);
	});
});
