import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from 'bun:test';
import {
	type ExecutionResult,
	type GraphQLError,
	parse,
	subscribe,
} from 'graphql';
import { HttpResponse, http } from 'msw';
import { ENDPOINT, schema } from '../test/fixture';
import * as defaults from '../test/msw';
import { setupFetchNetwork } from '../test/network';
import type { SubscriptionExecutor } from './runtime';

// The generated subscription handlers, served by msw's network in this
// process. The executor stands in for @nxgt/msw-graphql's: it streams the
// schema's Subscription resolvers as graphql-sse distinct connections.
const server = setupFetchNetwork();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const USER_CHANGED =
	'subscription UserChanged($id: ID!) { userChanged(id: $id) { id name } }';
const JOINED = 'subscription Joined { joined { id } }';
const SSE = 'text/event-stream';

/** An executor over `schema`: each event of `userChanged` is one `next`, then `complete`. */
function executor(calls: unknown[] = []): SubscriptionExecutor {
	return async ({ query, variables, operationName }) => {
		calls.push({ query, variables, operationName });
		const stream = await subscribe({
			schema,
			document: parse(query),
			variableValues: variables ?? {},
			rootValue: {
				userChanged: async function* (args: { id: string }) {
					yield { userChanged: { id: args.id, name: 'Ada' } };
					yield { userChanged: { id: args.id, name: 'Ada L.' } };
				},
			},
		});
		if (!('next' in stream)) return HttpResponse.json(stream, { status: 400 });
		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			async start(controller) {
				for await (const result of stream as AsyncIterable<ExecutionResult>)
					controller.enqueue(
						encoder.encode(`event: next\ndata: ${JSON.stringify(result)}\n\n`),
					);
				controller.enqueue(encoder.encode('event: complete\ndata:\n\n'));
				controller.close();
			},
		});
		return new Response(body, { headers: { 'content-type': SSE } });
	};
}

function send(
	query: string,
	variables: Record<string, unknown>,
	accept = SSE,
	url = ENDPOINT,
): Promise<Response> {
	return fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept },
		body: JSON.stringify({ query, variables }),
	});
}

describe('a subscription handler', () => {
	test('streams the schema resolver over SSE, with no wrapper around fetch', async () => {
		const calls: unknown[] = [];
		server.use(defaults.mockUserChangedSubscription(executor(calls)));
		const response = await send(USER_CHANGED, { id: 'u_1' });
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain(SSE);
		const text = await response.text();
		expect(text).toContain(
			'event: next\ndata: {"data":{"userChanged":{"id":"u_1","name":"Ada"}}}',
		);
		expect(text).toContain('"name":"Ada L."');
		expect(text.trimEnd().endsWith('event: complete\ndata:')).toBe(true);
		expect(calls).toEqual([
			{
				query: USER_CHANGED,
				variables: { id: 'u_1' },
				operationName: null,
			},
		]);
	});

	test('a subscription without variables has a handler too', async () => {
		server.use(
			defaults.mockJoinedSubscription(
				async () => new Response('event: complete\ndata:\n\n'),
			),
		);
		const response = await send(JOINED, {});
		expect(await response.text()).toContain('event: complete');
	});

	test('answers only the subscription it is named for', async () => {
		server.use(
			defaults.mockUserChangedSubscription(executor()),
			http.post(ENDPOINT, () => HttpResponse.json({ data: 'other' })),
		);
		const response = await send(JOINED, {});
		expect(await response.json()).toEqual({ data: 'other' });
	});

	test('lets a request without the event-stream Accept through', async () => {
		server.use(
			defaults.mockUserChangedSubscription(executor()),
			http.post(ENDPOINT, () => HttpResponse.json({ data: 'plain' })),
		);
		const response = await send(
			USER_CHANGED,
			{ id: 'u_1' },
			'application/json',
		);
		expect(await response.json()).toEqual({ data: 'plain' });
	});

	test('refuses invalid variables with the default 400, without calling the executor', async () => {
		const calls: unknown[] = [];
		server.use(defaults.mockUserChangedSubscription(executor(calls)));
		const response = await send(USER_CHANGED, { id: 'x' });
		expect(response.status).toBe(400);
		expect(calls).toEqual([]);
		const body = (await response.json()) as { errors: GraphQLError[] };
		expect(body.errors).toHaveLength(1);
	});

	test('honours the endpoint option', async () => {
		server.use(
			defaults.mockUserChangedSubscription(executor(), {
				endpoint: 'https://other.example.com/graphql',
			}),
		);
		const response = await send(
			USER_CHANGED,
			{ id: 'u_1' },
			SSE,
			'https://other.example.com/graphql',
		);
		expect(await response.text()).toContain('event: next');
	});
});
