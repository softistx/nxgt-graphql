import type { AnyReply } from '@nxgt/httpyz';
import type { Operation } from './document';
import { callKey } from './keys';
import { bodyOf, isPersistedQueryNotFound } from './persisted';
import { dataOf, replyError } from './response';
import { post, register, type Sending, send, type Transport } from './send';
import { Party } from './share';

/** How many queries a batch holds, and how long it waits for more. */
export interface BatchOptions {
	/** The most queries in one request; a full batch leaves at once. Default: `10`. */
	max?: number;
	/** Milliseconds a batch waits for more queries. Default: `0`, the same macrotask. */
	wait?: number;
}

interface Entry {
	readonly operation: Operation;
	readonly variables: unknown;
	readonly signal: AbortSignal | undefined;
	readonly resolve: (data: unknown) => void;
	readonly reject: (error: unknown) => void;
}

interface Batch {
	readonly key: string;
	readonly sending: Sending;
	readonly party: Party;
	readonly entries: Entry[];
	timer?: ReturnType<typeof setTimeout>;
}

/**
 * Queries issued together, with the same headers, timeout and retries, are
 * posted as one JSON array, and each gets its own entry of the reply's. Each
 * keeps its own signal: an entry aborted before the batch leaves is dropped
 * from it, and a batch sent is aborted only once every entry has left.
 */
export class Batcher {
	readonly #open = new Map<string, Batch>();
	readonly #max: number;
	readonly #wait: number;

	constructor(
		private readonly transport: Transport,
		{ max = 10, wait = 0 }: BatchOptions,
	) {
		this.#max = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 10;
		this.#wait = wait;
	}

	run(
		operation: Operation,
		variables: unknown,
		{ call, retry, signal }: Sending,
	): Promise<unknown> {
		if (signal?.aborted) return Promise.reject(signal.reason);
		const key = callKey(call, retry);
		const batch = this.#open.get(key) ?? this.#start(key, { call, retry });
		let resolve!: Entry['resolve'];
		let reject!: Entry['reject'];
		const result = new Promise<unknown>((ok, fail) => {
			resolve = ok;
			reject = fail;
		});
		batch.entries.push({ operation, variables, signal, resolve, reject });
		const joined = batch.party.join(result, signal);
		if (batch.entries.length >= this.#max) this.#flush(batch);
		return joined;
	}

	#start(key: string, { call, retry }: Omit<Sending, 'signal'>): Batch {
		// Every entry left before it was sent: the batch is never sent.
		const party = new Party(() => this.#close(batch));
		const batch: Batch = {
			key,
			sending: { call, retry, signal: party.signal },
			party,
			entries: [],
		};
		batch.timer = setTimeout(() => this.#flush(batch), this.#wait);
		this.#open.set(key, batch);
		return batch;
	}

	#close(batch: Batch): void {
		clearTimeout(batch.timer);
		if (this.#open.get(batch.key) === batch) this.#open.delete(batch.key);
	}

	#flush(batch: Batch): void {
		this.#close(batch);
		const entries = batch.entries.filter((entry) => !entry.signal?.aborted);
		if (entries.length === 0) return;
		const [only] = entries;
		if (entries.length === 1 && only) {
			send(this.transport, only.operation, only.variables, batch.sending).then(
				only.resolve,
				only.reject,
			);
			return;
		}
		this.#post(entries, batch.sending).catch((error: unknown) => {
			for (const entry of entries) entry.reject(error);
		});
	}

	async #post(entries: readonly Entry[], sending: Sending): Promise<void> {
		const { persisted } = this.transport;
		const bodies = await Promise.all(
			entries.map((entry) =>
				bodyOf(entry.operation, entry.variables, persisted),
			),
		);
		const reply = await post(this.transport, bodies, sending);
		const items = itemsOf(reply, entries.length);
		if (!items) {
			const error = replyError(reply);
			for (const entry of entries) entry.reject(error);
			return;
		}
		entries.forEach((entry, index) => {
			this.#settle(entry, items[index], reply.status, sending);
		});
	}

	#settle(entry: Entry, item: unknown, status: number, sending: Sending): void {
		try {
			entry.resolve(dataOf(item, status));
		} catch (error) {
			if (isPersistedQueryNotFound(this.transport.persisted, error)) {
				// Registered alone, with its text, aborted by its own signal only.
				register(this.transport, entry.operation, entry.variables, {
					...sending,
					signal: entry.signal,
				}).then(entry.resolve, entry.reject);
			} else entry.reject(error);
		}
	}
}

/** The reply's entries, when it is an array of the batch's length. */
function itemsOf(reply: AnyReply, length: number): unknown[] | undefined {
	return Array.isArray(reply.data) && reply.data.length === length
		? reply.data
		: undefined;
}
