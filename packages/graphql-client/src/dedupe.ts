import { Party } from './share';

interface Flight<T> {
	readonly promise: Promise<T>;
	readonly party: Party;
}

/**
 * Identical queries in flight share one request. Each caller keeps its own
 * signal: aborting it rejects that caller alone, and the shared request is
 * aborted only once every caller has left.
 */
export class Deduplicator {
	readonly #flights = new Map<string, Flight<unknown>>();

	run<T>(
		key: string,
		signal: AbortSignal | undefined,
		send: (signal: AbortSignal) => Promise<T>,
	): Promise<T> {
		// Already aborted: neither join a request nor start one.
		if (signal?.aborted) return Promise.reject(signal.reason);
		let flight = this.#flights.get(key) as Flight<T> | undefined;
		if (!flight) flight = this.#start(key, send);
		return flight.party.join(flight.promise, signal);
	}

	#start<T>(key: string, send: (signal: AbortSignal) => Promise<T>): Flight<T> {
		const forget = () => {
			if (this.#flights.get(key) === flight) this.#flights.delete(key);
		};
		// Nobody waits any more: a later identical query starts afresh.
		const party = new Party(forget);
		const flight: Flight<T> = { promise: send(party.signal), party };
		this.#flights.set(key, flight);
		flight.promise.then(forget, forget);
		return flight;
	}
}
