import { describe, expect, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { normalizedCache } from './cache/normalized-cache';
import { missingTypename } from './cache/typename';
import { createGraphQLClient } from './client';

type Book = { __typename: 'Book'; id: string; title: string };
const BookQuery = parse(
	'query Book($id: ID!) { book(id: $id) { id title } }',
) as TypedDocumentNode<{ book: Book }, { id: string }>;
const AuthorQuery = parse(
	'query Author($id: ID!) { author(id: $id) { id name } }',
) as TypedDocumentNode<
	{ author: { __typename: 'Author'; id: string; name: string } },
	{ id: string }
>;
const BookChanged = parse(
	'subscription BookChanged { bookChanged { id title } }',
) as TypedDocumentNode<{ bookChanged: Book }, Record<string, never>>;

type Body = Record<string, unknown>;

const answers: Record<string, unknown> = {
	Book: { book: { __typename: 'Book', id: '1', title: 'Dune' } },
	Author: { author: { __typename: 'Author', id: '7', name: 'Herbert' } },
};
const answerOf = (body: Body) => ({
	data: answers[String(body['operationName'])],
});

/** A fetch recording each body: a batch's array answered entry by entry. */
function server() {
	const sent: (Body | Body[])[] = [];
	const fetch = async (request: Request) => {
		const body = (await request.json()) as Body | Body[];
		sent.push(body);
		return Response.json(
			Array.isArray(body) ? body.map(answerOf) : answerOf(body),
		);
	};
	return { fetch, sent };
}

const url = 'https://api.test/graphql';

describe('batching with a cache', () => {
	test('two queries posted as one array, both written, then served from the cache', async () => {
		const api = server();
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			batch: {},
			cache: normalizedCache(),
		});
		const [book, author] = await Promise.all([
			client.query(BookQuery, { id: '1' }),
			client.query(AuthorQuery, { id: '7' }),
		]);
		expect(book).toEqual(answers['Book'] as never);
		expect(author).toEqual(answers['Author'] as never);
		expect(api.sent).toHaveLength(1);
		const [batch] = api.sent as [Body[]];
		expect(Array.isArray(batch)).toBe(true);
		expect(batch.map((body) => body['operationName'])).toEqual([
			'Book',
			'Author',
		]);
		expect(String(batch[0]?.['query'])).toContain('__typename');

		expect(client.cache?.read(BookQuery, { id: '1' })).toEqual(book);
		expect(client.cache?.read(AuthorQuery, { id: '7' })).toEqual(author);
		expect(
			await Promise.all([
				client.query(BookQuery, { id: '1' }),
				client.query(AuthorQuery, { id: '7' }),
			]),
		).toEqual([book, author]);
		expect(api.sent).toHaveLength(1);
	});
});

describe('documentId persisted queries with a cache', () => {
	test('a document missing __typename is refused before anything is sent', async () => {
		const api = server();
		const client = createGraphQLClient({
			url,
			fetch: api.fetch,
			persisted: { mode: 'documentId' },
			cache: normalizedCache(),
		});
		const hashed = Object.assign(
			parse('query Book($id: ID!) { book(id: $id) { id title } }'),
			{ __meta__: { hash: 'book-hash' } },
		) as TypedDocumentNode<{ book: Book }, { id: string }>;
		const error = await client
			.query(hashed, { id: '1' })
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(TypeError);
		expect((error as TypeError).message).toBe(missingTypename);
		expect(api.sent).toHaveLength(0);
	});
});

describe('subscriptions on a client with a cache', () => {
	test('the operation is posted as written, no __typename added', async () => {
		const posted: Body[] = [];
		const client = createGraphQLClient({
			url,
			cache: normalizedCache(),
			fetch: async (request) => {
				posted.push((await request.json()) as Body);
				const result = { data: { bookChanged: { id: '1', title: 'Dune' } } };
				return new Response(
					`event: next\ndata: ${JSON.stringify(result)}\n\nevent: complete\ndata:\n\n`,
					{ headers: { 'content-type': 'text/event-stream' } },
				);
			},
		});
		const results: unknown[] = [];
		for await (const data of client.subscribe(BookChanged)) results.push(data);
		expect(results).toEqual([{ bookChanged: { id: '1', title: 'Dune' } }]);
		expect(posted).toHaveLength(1);
		expect(String(posted[0]?.['query'])).not.toContain('__typename');
	});
});
