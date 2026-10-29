import { type DocumentNode, Kind, parse } from 'graphql';
import { type HttpHandler, http } from 'msw';
import type { MockedOperation, MockOptions } from './mock-operation';
import { refuseInvalid } from './mock-operation';

/**
 * What a subscription handler hands the request to: the shape of
 * `@nxgt/msw-graphql`'s `Executor` (`createExecutor({ schema })`), which
 * streams the schema's `Subscription` resolvers as graphql-sse distinct
 * connections. Declared here so this package needs no dependency on it.
 */
export type SubscriptionExecutor = (input: {
	query: string;
	variables?: Record<string, unknown> | null;
	operationName?: string | null;
	request: Request;
}) => Promise<Response>;

/** One subscription, as the generated file describes it. */
export interface MockedSubscription extends Omit<MockedOperation, 'type'> {
	readonly type: 'subscription';
}

interface Body {
	readonly query: string;
	readonly variables?: Record<string, unknown> | null;
	readonly operationName?: string | null;
}

/**
 * An msw handler for one subscription: a POST to the endpoint that asks for
 * `Accept: text/event-stream` and whose operation is the subscription named
 * `operation.name`. Its variables are checked as a query's are, then the
 * request goes to `execute`, whose response (the event stream) is the
 * answer. Any other request, including this subscription sent without the
 * event-stream `Accept`, is left to the next handler.
 */
export function mockSubscription(
	operation: MockedSubscription,
	execute: SubscriptionExecutor,
	options: MockOptions = {},
): HttpHandler {
	const { endpoint = operation.endpoint, ...handlerOptions } = options;
	const where = { type: operation.type, name: operation.name };
	return http.post(
		endpoint,
		async ({ request }) => {
			if (!(request.headers.get('accept') ?? '').includes('text/event-stream'))
				return undefined;
			const body = await bodyOf(request.clone());
			if (!body || !isNamedSubscription(body, operation.name)) return undefined;
			const info = {
				query: body.query,
				operationName: body.operationName ?? operation.name,
				variables: body.variables ?? {},
			};
			const refusal = await refuseInvalid(operation, info, where);
			if (refusal) return refusal;
			return execute({
				query: body.query,
				variables: body.variables ?? null,
				operationName: body.operationName ?? null,
				request,
			});
		},
		handlerOptions,
	);
}

async function bodyOf(request: Request): Promise<Body | undefined> {
	try {
		const body: unknown = await request.json();
		if (
			typeof body === 'object' &&
			body !== null &&
			typeof (body as { query?: unknown }).query === 'string'
		)
			return body as Body;
	} catch {
		// Not JSON: not ours.
	}
	return undefined;
}

/** Whether the operation the body selects is the subscription `name`. */
function isNamedSubscription(body: Body, name: string): boolean {
	let document: DocumentNode;
	try {
		document = parse(body.query);
	} catch {
		return false;
	}
	const operations = document.definitions.filter(
		(node) => node.kind === Kind.OPERATION_DEFINITION,
	);
	const selected = body.operationName
		? operations.find((node) => node.name?.value === body.operationName)
		: operations.length === 1
			? operations[0]
			: undefined;
	return (
		selected?.operation === 'subscription' && selected.name?.value === name
	);
}
