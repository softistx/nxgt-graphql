/**
 * Callers waiting on one request. Each keeps its own signal: aborting it
 * rejects that caller alone, and the request's `signal` aborts only once
 * every caller has left. A caller without a signal never leaves.
 */
export class Party {
	readonly #controller = new AbortController();
	readonly #onEmpty: () => void;
	#waiting = 0;

	/** `onEmpty` runs when the last caller leaves, before the request is aborted. */
	constructor(onEmpty: () => void = () => {}) {
		this.#onEmpty = onEmpty;
	}

	/** The request's signal. */
	get signal(): AbortSignal {
		return this.#controller.signal;
	}

	/** `result` for this caller, or its signal's reason as soon as it aborts. */
	join<T>(result: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
		this.#waiting++;
		if (!signal) return result;
		return new Promise<T>((resolve, reject) => {
			const leave = () => {
				reject(signal.reason);
				this.#waiting--;
				if (this.#waiting === 0) {
					this.#onEmpty();
					this.#controller.abort(signal.reason);
				}
			};
			signal.addEventListener('abort', leave, { once: true });
			result.then(
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
