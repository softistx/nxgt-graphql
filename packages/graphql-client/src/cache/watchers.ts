import { reportError } from '../report';
import type { Changes, Dependencies } from './changes';

/** One watch: what its last read used, and how to read again and call back. */
export interface Watch {
	deps: Dependencies;
	readonly refresh: () => void;
}

/** The live watches, each called back once per batch of changes that touched it. */
export class Watchers {
	readonly #watches = new Set<Watch>();

	/** Adds a watch; the function returned removes it. */
	add(watch: Watch): () => void {
		this.#watches.add(watch);
		return () => {
			this.#watches.delete(watch);
		};
	}

	/**
	 * Refreshes each watch the changes touched. One that throws is reported,
	 * not thrown: the others still run, and the write that caused it stands.
	 */
	notify(changes: Changes): void {
		if (changes.empty) return;
		for (const watch of [...this.#watches]) {
			// Stopped by an earlier callback of this same batch.
			if (!this.#watches.has(watch)) continue;
			if (!watch.deps.touchedBy(changes)) continue;
			try {
				watch.refresh();
			} catch (error) {
				reportError(error);
			}
		}
	}
}
