/** An object as the store holds it: its fields by field key (`book({"id":"1"})`). */
export type StoreObject = Record<string, unknown>;

/** A field holding an entity: the entity's key, `{ __ref: 'Book:1' }`. */
export interface Reference {
	readonly __ref: string;
}

export function isPlainObject(value: unknown): value is StoreObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isReference(value: unknown): value is Reference {
	return (
		isPlainObject(value) &&
		typeof value['__ref'] === 'string' &&
		Object.keys(value).length === 1
	);
}

/** Two stored values alike in every field: a write that changes nothing notifies nobody. */
export function equal(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (Array.isArray(a)) {
		return (
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((item, index) => equal(item, b[index]))
		);
	}
	if (!isPlainObject(a) || !isPlainObject(b)) return false;
	const keys = Object.keys(a);
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
	);
}

/** `extra`'s fields added into `target`, objects merged field by field. */
export function deepMerge(target: StoreObject, extra: StoreObject): void {
	for (const [key, value] of Object.entries(extra)) {
		const current = target[key];
		if (isPlainObject(current) && isPlainObject(value))
			deepMerge(current, value);
		else target[key] = value;
	}
}
