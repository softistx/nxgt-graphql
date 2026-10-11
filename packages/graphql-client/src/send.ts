import type { AnyReply, HttpClient, RetryOptions } from '@nxgt/httpyz';
import type { Operation } from './document';
import type { CallOptions, QueryRetry } from './options';
import { dataOf, transportError } from './response';

/** Where operations go: data only, shared by every call of a client. */
export interface Transport {
	readonly http: HttpClient;
	readonly path: string;
}

/** One send: the call's options, its retries (`false` for a mutation), its signal. */
export interface Sending {
	readonly call: CallOptions;
	readonly retry: QueryRetry | undefined;
	readonly signal: AbortSignal | undefined;
}

const accept = 'application/graphql-response+json, application/json';

/** Posts an operation and returns its `data`, or throws the error it stands for. */
export async function send(
	transport: Transport,
	operation: Operation,
	variables: unknown,
	{ call, retry, signal }: Sending,
): Promise<unknown> {
	const headers = new Headers(call.headers);
	if (!headers.has('accept')) headers.set('accept', accept);
	let reply: AnyReply;
	try {
		reply = await transport.http.post(transport.path, {
			json: {
				query: operation.query,
				variables: variables ?? {},
				operationName: operation.operationName,
			},
			headers,
			...(signal && { signal }),
			...(call.timeout !== undefined && { timeout: call.timeout }),
			...(retry !== undefined && { retry: retrySettings(retry) }),
			...(operation.operationName !== undefined && {
				operationId: operation.operationName,
			}),
		});
	} catch (error) {
		// The caller's own abort wins over what it caused.
		if (signal?.aborted) throw signal.reason;
		throw transportError(error);
	}
	return dataOf(reply);
}

/** httpyz retries no POST by default: a query's retries name it. */
function retrySettings(retry: QueryRetry): RetryOptions | false {
	if (retry === false) return false;
	if (typeof retry === 'number') return { attempts: retry, methods: ['post'] };
	return { ...retry, methods: ['post'] };
}
