interface Flight<T> {
	readonly promise: Promise<T>;
	readonly controller: AbortController;
	waiting: number;
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
		if (!flight) {
			const controller = new AbortController();
			const promise = send(controller.signal);
			const started: Flight<T> = { promise, controller, waiting: 0 };
			this.#flights.set(key, started);
			const forget = () => {
				if (this.#flights.get(key) === started) this.#flights.delete(key);
			};
			promise.then(forget, forget);
			flight = started;
		}
		return this.#wait(key, flight, signal);
	}

	#wait<T>(
		key: string,
		flight: Flight<T>,
		signal: AbortSignal | undefined,
	): Promise<T> {
		if (!signal) {
			flight.waiting++;
			return flight.promise;
		}
		flight.waiting++;
		return new Promise<T>((resolve, reject) => {
			const leave = () => {
				reject(signal.reason);
				flight.waiting--;
				if (flight.waiting === 0) {
					// Nobody waits any more: a later identical query starts afresh.
					if (this.#flights.get(key) === flight) this.#flights.delete(key);
					flight.controller.abort(signal.reason);
				}
			};
			signal.addEventListener('abort', leave, { once: true });
			flight.promise.then(
				(value) => {
					signal.removeEventListener('abort', leave);
					resolve(value);
				},
				(error: unknown) => {
					signal.removeEventListener('abort', leave);
					reject(error);
				},
			);
		});
	}
}
