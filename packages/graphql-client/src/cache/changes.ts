/**
 * What a batch of writes changed: fields per entity, or a whole entity
 * (created or evicted), or everything (a reset).
 */
export class Changes {
	everything = false;
	readonly entities = new Map<string, Set<string> | 'all'>();

	field(entity: string, field: string): void {
		const fields = this.entities.get(entity);
		if (fields === 'all') return;
		if (fields) fields.add(field);
		else this.entities.set(entity, new Set([field]));
	}

	entity(entity: string): void {
		this.entities.set(entity, 'all');
	}

	get empty(): boolean {
		return !this.everything && this.entities.size === 0;
	}
}

/** The entities and fields one read used: what a watch waits on. */
export class Dependencies {
	readonly #entities = new Map<string, Set<string>>();

	/** The entity was looked up, whether or not the cache held it. */
	entity(entity: string): Set<string> {
		let fields = this.#entities.get(entity);
		if (!fields) {
			fields = new Set();
			this.#entities.set(entity, fields);
		}
		return fields;
	}

	field(entity: string, field: string): void {
		this.entity(entity).add(field);
	}

	touchedBy(changes: Changes): boolean {
		if (changes.everything) return true;
		for (const [entity, changed] of changes.entities) {
			const used = this.#entities.get(entity);
			if (!used) continue;
			if (changed === 'all') return true;
			for (const field of changed) if (used.has(field)) return true;
		}
		return false;
	}
}
