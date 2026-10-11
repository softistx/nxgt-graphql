import { logError } from '../report';
import type { Changes, Dependencies } from './changes';

/** The most rounds one notify runs: callbacks that keep writing are stopped. */
const MAX_ROUNDS = 100;

/** One watch: what its last read used, and how to read again and call back. */
export interface Watch {
	deps: Dependencies;
	readonly refresh: () => void;
}

/** The live watches, each called back once per batch of changes that touched it. */
export class Watchers {
	readonly #watches = new Set<Watch>();
	readonly #onError: (error: unknown) => void;
	/** Batches made by a callback while a notify runs, run after the current one. */
	readonly #pending: Changes[] = [];
	#notifying = false;

	/** `onError` gets what a callback throws. */
	constructor(onError: (error: unknown) => void) {
		this.#onError = onError;
	}

	/** Adds a watch; the function returned removes it. */
	add(watch: Watch): () => void {
		this.#watches.add(watch);
		return () => {
			this.#watches.delete(watch);
		};
	}

	/**
	 * Refreshes each watch the changes touched. One that throws is handed to
	 * `onError`, not thrown: the others still run, and the write that caused
	 * it stands. A batch made by a callback (a write inside a watch) is
	 * queued and run once the current one is over, so the callbacks run one
	 * after the other, each whole, and every watch ends on the newest data.
	 */
	notify(changes: Changes): void {
		if (changes.empty) return;
		this.#pending.push(changes);
		if (this.#notifying) return;
		this.#notifying = true;
		try {
			let rounds = 0;
			for (
				let next = this.#pending.shift();
				next !== undefined;
				next = this.#pending.shift()
			) {
				if (rounds++ >= MAX_ROUNDS) {
					this.#pending.length = 0;
					this.#report(
						new Error(
							`Watch callbacks kept writing: stopped after ${MAX_ROUNDS} rounds`,
						),
					);
					break;
				}
				this.#refresh(next);
			}
		} finally {
			this.#notifying = false;
		}
	}

	#refresh(changes: Changes): void {
		for (const watch of [...this.#watches]) {
			// Stopped by an earlier callback of this same batch.
			if (!this.#watches.has(watch)) continue;
			if (!watch.deps.touchedBy(changes)) continue;
			try {
				watch.refresh();
			} catch (error) {
				this.#report(error);
			}
		}
	}

	/** To `onError`; one that throws is logged, so it never breaks a write. */
	#report(error: unknown): void {
		try {
			this.#onError(error);
		} catch (reported) {
			logError(reported);
		}
	}
}
