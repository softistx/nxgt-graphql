import {
	type EventStream,
	type ServerEvent,
	UndeclaredStatusError,
} from '@nxgt/httpyz';
import type { Operation } from './document';
import { ApiUnavailableError } from './errors';
import type { SubscribeOptions, Subscription } from './options';
import {
	bodyOf,
	isPersistedQueryNotFound,
	type OperationBody,
	withQuery,
} from './persisted';
import { dataOf, refusedError, transportError } from './response';
import type { Transport } from './send';

/** Runs on each error before the loop rejects with it: the client's 401 hook. */
export type OnFailure = (error: unknown) => Promise<void>;

/** graphql-sse's distinct connections mode: a result per `next`, then `complete`. */
const events = { next: null, complete: null };

/**
 * One subscription over server-sent events: the operation posted with
 * `accept: text/event-stream`, each `next` event's result yielded. It is
 * never retried nor reconnected; in `apq` mode, a hash the server does not
 * hold yet is posted once more with its text, since nothing ran. Its
 * connection closes whichever way the loop ends.
 */
export class EventSubscription implements Subscription<unknown> {
	#stream: EventStream<ServerEvent> | undefined;
	#started = false;
	#closed = false;
	#delivered = false;

	constructor(
		private readonly transport: Transport,
		private readonly operation: Operation,
		private readonly variables: unknown,
		private readonly options: SubscribeOptions,
		private readonly onFailure: OnFailure,
	) {}

	[Symbol.asyncIterator](): AsyncIterator<unknown> {
		if (this.#started) throw new TypeError('A subscription is read once');
		this.#started = true;
		return this.#read();
	}

	close(): void {
		this.#closed = true;
		this.#stream?.close();
	}

	async *#read(): AsyncGenerator<unknown, void, undefined> {
		const { signal } = this.options;
		signal?.throwIfAborted();
		const { persisted } = this.transport;
		let body = await bodyOf(this.operation, this.variables, persisted);
		for (let registering = false; !this.#closed; registering = true) {
			try {
				yield* this.#results(this.#open(body));
				return;
			} catch (error) {
				// The caller's own abort wins over what it caused.
				if (signal?.aborted) throw signal.reason;
				const failure = await failureOf(error);
				const notFound = isPersistedQueryNotFound(persisted, failure);
				if (registering || this.#delivered || !notFound) {
					await this.onFailure(failure);
					throw failure;
				}
				body = withQuery(this.operation, body);
			}
		}
	}

	/** Each `next` event's `data`, until `complete`, the stream's end or `close()`. */
	async *#results(
		stream: EventStream<ServerEvent>,
	): AsyncGenerator<unknown, void, undefined> {
		try {
			for await (const event of stream) {
				if (event.event === 'complete') return;
				const data = dataOf(resultOf(event.data), 200);
				this.#delivered = true;
				yield data;
				if (this.#closed) return;
			}
		} finally {
			stream.close();
		}
	}

	#open(body: OperationBody): EventStream<ServerEvent> {
		const { signal, headers } = this.options;
		const { operationName } = this.operation;
		this.#stream = this.transport.http.events(this.transport.path, {
			method: 'post',
			json: body,
			events,
			reconnect: false,
			retry: false,
			...(headers && { headers }),
			...(signal && { signal }),
			...(operationName !== undefined && { operationId: operationName }),
		}) as EventStream<ServerEvent>;
		return this.#stream;
	}
}

/** A `next` event's data: a JSON execution result. */
function resultOf(data: string): unknown {
	try {
		return JSON.parse(data);
	} catch (error) {
		throw new ApiUnavailableError('invalid-response', { cause: error });
	}
}

/** What a stream threw, as this package's errors: a refused connection's body read. */
async function failureOf(error: unknown): Promise<unknown> {
	if (error instanceof UndeclaredStatusError)
		return refusedError(error.response);
	return transportError(error);
}
