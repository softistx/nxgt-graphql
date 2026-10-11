import { describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { type DocumentNode, parse, print } from 'graphql';
import { createGraphQLClient } from '../client';
import { operationOf } from '../document';
import { sha256Hex } from '../persisted';
import { normalizedCache } from './normalized-cache';
import { cachedOperation, missingTypename, withTypename } from './typename';

/** Freezes a document's nodes (not `loc`, whose tokens link both ways). */
function deepFreeze<T>(value: T): T {
	if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
		for (const [key, child] of Object.entries(value))
			if (key !== 'loc') deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

function server(data: unknown) {
	const sent: Record<string, unknown>[] = [];
	const fetch = async (request: Request) => {
		sent.push((await request.json()) as Record<string, unknown>);
		return Response.json({ data });
	};
	return { fetch, sent };
}

const url = 'https://api.test/graphql';

describe('withTypename', () => {
	test('every selection set but the operation’s own, fragments included; the document untouched', () => {
		const document = deepFreeze(
			parse(`query { viewer { id friends { __typename name } ... on User { pet { name } } ...F } }
			fragment F on User { team { id } }`),
		);
		const before = print(document);
		const result = withTypename(document);
		expect(print(document)).toBe(before);
		expect(print(result)).toBe(
			print(
				parse(`query { viewer { id friends { __typename name } ... on User { pet { name __typename } __typename } ...F __typename } }
				fragment F on User { team { id __typename } __typename }`),
			),
		);
		expect(withTypename(document)).toBe(result);
	});

	test('nothing to add: the same document', () => {
		const document = parse('{ a viewer { __typename id } }');
		expect(withTypename(document)).toBe(document);
	});
});

describe('cachedOperation', () => {
	test('a subscription is left as it is', () => {
		const operation = operationOf(
			parse('subscription { tick { at } }') as never,
		);
		expect(cachedOperation(operation, false)).toBe(operation);
	});

	test('documentId mode refuses a document missing __typename, and keeps one that has it', () => {
		const missing = operationOf(parse('{ viewer { id } }') as never);
		expect(() => cachedOperation(missing, { mode: 'documentId' })).toThrow(
			missingTypename,
		);
		const whole = operationOf(parse('{ viewer { __typename id } }') as never);
		expect(cachedOperation(whole, { mode: 'documentId' })).toBe(whole);
	});
});

describe('the client with a cache', () => {
	type Viewer = { viewer: { id: string } };
	const ViewerQuery = parse(
		'query Viewer { viewer { id } }',
	) as TypedDocumentNode<Viewer, Record<string, never>>;

	test('sends __typename in every selection set but the root, the document left untouched', async () => {
		const frozen = deepFreeze(ViewerQuery as DocumentNode);
		const before = print(frozen);
		const api = server({ viewer: { __typename: 'User', id: 'u' } });
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			cache: normalizedCache(),
		});
		await client.query(ViewerQuery);
		expect(api.sent[0]?.['query']).toBe(
			'query Viewer {\n  viewer {\n    id\n    __typename\n  }\n}',
		);
		expect(print(frozen)).toBe(before);
	});

	test('sends the document as it is without a cache', async () => {
		const api = server({ viewer: { id: 'u' } });
		const client = createGraphQLClient({ url, fetch: api.fetch });
		await client.query(ViewerQuery);
		expect(api.sent[0]?.['query']).toBe(print(ViewerQuery as DocumentNode));
		expect(client.cache).toBeUndefined();
	});

	test('apq hashes the text it sends, __typename included', async () => {
		const api = server({ viewer: { __typename: 'User', id: 'u' } });
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'apq' },
			cache: normalizedCache(),
		});
		await client.query(ViewerQuery);
		const extensions = api.sent[0]?.['extensions'] as {
			persistedQuery: { sha256Hash: string };
		};
		expect(extensions.persistedQuery.sha256Hash).toBe(
			await sha256Hex(
				'query Viewer {\n  viewer {\n    id\n    __typename\n  }\n}',
			),
		);
	});

	test('documentId mode refuses a document missing __typename before anything is sent', async () => {
		const api = server({ viewer: { id: 'u' } });
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'documentId' },
			cache: normalizedCache(),
		});
		const hashed = Object.assign(parse('query Viewer { viewer { id } }'), {
			__meta__: { hash: 'h1' },
		}) as unknown as typeof ViewerQuery;
		await expect(client.query(hashed)).rejects.toThrow(missingTypename);
		expect(api.sent).toHaveLength(0);
		const withIt = Object.assign(
			parse('query Viewer { __typename viewer { __typename id } }'),
			{
				__meta__: { hash: 'h2' },
			},
		) as unknown as typeof ViewerQuery;
		await client.query(withIt);
		expect(api.sent[0]?.['documentId']).toBe('h2');
	});
});
