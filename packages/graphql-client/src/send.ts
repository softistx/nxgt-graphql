import type { AnyReply, HttpClient, RetryOptions } from '@nxgt/httpyz';
import type { Operation } from './document';
import type { CallOptions, QueryRetry } from './options';
import {
	bodyOf,
	isPersistedQueryNotFound,
	type OperationBody,
	type PersistedQueries,
	withQuery,
} from './persisted';
import { dataOf, transportError } from './response';

/** Where operations go and how they are named: data only, shared by every call of a client. */
export interface Transport {
	readonly http: HttpClient;
	readonly path: string;
	readonly persisted: PersistedQueries;
}

/** One send: the call's options, its retries (`false` for a mutation), its signal. */
export interface Sending {
	readonly call: CallOptions;
	readonly retry: QueryRetry | undefined;
	readonly signal: AbortSignal | undefined;
}

const accept = 'application/graphql-response+json, application/json';

/**
 * Posts an operation and returns its `data`, or throws the error it stands
 * for. In `apq` mode, a hash the server does not hold yet is sent once more
 * with its text: nothing ran, so a mutation goes too.
 */
export async function send(
	transport: Transport,
	operation: Operation,
	variables: unknown,
	sending: Sending,
): Promise<unknown> {
	const body = await bodyOf(operation, variables, transport.persisted);
	try {
		return await sendBody(transport, operation, body, sending);
	} catch (error) {
		if (!isPersistedQueryNotFound(transport.persisted, error)) throw error;
		return sendBody(transport, operation, withQuery(operation, body), sending);
	}
}

/** APQ's registration alone: the operation's hash and its text. */
export async function register(
	transport: Transport,
	operation: Operation,
	variables: unknown,
	sending: Sending,
): Promise<unknown> {
	const body = await bodyOf(operation, variables, transport.persisted);
	return sendBody(transport, operation, withQuery(operation, body), sending);
}

async function sendBody(
	transport: Transport,
	operation: Operation,
	body: OperationBody,
	sending: Sending,
): Promise<unknown> {
	const reply = await post(transport, body, sending, operation.operationName);
	return dataOf(reply.data, reply.status);
}

/** One POST of a body, or of a batch's array; the transport's errors mapped. */
export async function post(
	transport: Transport,
	json: OperationBody | readonly OperationBody[],
	{ call, retry, signal }: Sending,
	operationId?: string,
): Promise<AnyReply> {
	const headers = new Headers(call.headers);
	if (!headers.has('accept')) headers.set('accept', accept);
	try {
		return await transport.http.post(transport.path, {
			json,
			headers,
			...(signal && { signal }),
			...(call.timeout !== undefined && { timeout: call.timeout }),
			...(retry !== undefined && { retry: retrySettings(retry) }),
			...(operationId !== undefined && { operationId }),
		});
	} catch (error) {
		// The caller's own abort wins over what it caused.
		if (signal?.aborted) throw signal.reason;
		throw transportError(error);
	}
}

/** httpyz retries no POST by default: a query's retries name it. */
function retrySettings(retry: QueryRetry): RetryOptions | false {
	if (retry === false) return false;
	if (typeof retry === 'number') return { attempts: retry, methods: ['post'] };
	return { ...retry, methods: ['post'] };
}
