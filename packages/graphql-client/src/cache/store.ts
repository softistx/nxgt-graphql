import { Changes } from './changes';
import { fieldNameOf } from './field-key';
import type { FieldModifier } from './types';
import { equal, type StoreObject } from './values';

/**
 * The entities by key, each a record of fields by field key, and what
 * changed since the last `takeChanges()`. A write that leaves a value as it
 * was records nothing.
 */
export class EntityStore {
	readonly #entities = new Map<string, StoreObject>();
	#changes = new Changes();

	get(key: string): StoreObject | undefined {
		return this.#entities.get(key);
	}

	/** Sets each field given, keeping the others. */
	merge(key: string, fields: StoreObject): void {
		const entity = this.#entities.get(key);
		if (!entity) {
			this.#entities.set(key, { ...fields });
			this.#changes.entity(key);
			return;
		}
		for (const [field, value] of Object.entries(fields)) {
			if (Object.hasOwn(entity, field) && equal(entity[field], value)) continue;
			entity[field] = value;
			this.#changes.field(key, field);
		}
	}

	evict(key: string): boolean {
		if (!this.#entities.delete(key)) return false;
		this.#changes.entity(key);
		return true;
	}

	modify(
		key: string,
		modifiers: Readonly<Record<string, FieldModifier>>,
	): boolean {
		const entity = this.#entities.get(key);
		if (!entity) return false;
		for (const field of Object.keys(entity)) {
			const modifier = Object.hasOwn(modifiers, field)
				? modifiers[field]
				: Object.hasOwn(modifiers, fieldNameOf(field))
					? modifiers[fieldNameOf(field)]
					: undefined;
			if (!modifier) continue;
			const next = modifier(structuredClone(entity[field]));
			if (next === undefined) delete entity[field];
			else if (equal(entity[field], next)) continue;
			else entity[field] = next;
			this.#changes.field(key, field);
		}
		return true;
	}

	clear(): void {
		this.#entities.clear();
		this.#changes.everything = true;
	}

	/** What changed since the last call. */
	takeChanges(): Changes {
		const changes = this.#changes;
		this.#changes = new Changes();
		return changes;
	}
}
