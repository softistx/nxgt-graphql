/** An object as the store holds it: its fields by field key (`book({"id":"1"})`). */
export type StoreObject = Record<string, unknown>;

/** A field holding an entity: the entity's key, `{ __ref: 'Book:1' }`. */
export interface Reference {
	readonly __ref: string;
}

/** An object as JSON makes it: its prototype `Object.prototype` or `null`. */
export function isPlainObject(value: unknown): value is StoreObject {
	if (typeof value !== 'object' || value === null) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

/**
 * Refuses a value JSON could not hold: the cache holds JSON as the network
 * sends it (a custom scalar arrives as a string). `field` names the field
 * key the value was given for, in the error. A number must be finite, and an
 * object or array must not contain itself.
 */
export function assertJson(
	value: unknown,
	field: string,
	seen: WeakSet<object> = new WeakSet(),
): void {
	if (value === null || typeof value === 'string' || typeof value === 'boolean')
		return;
	if (typeof value === 'number') {
		if (Number.isFinite(value)) return;
		throw new TypeError(`The cache holds JSON: field ${field} holds ${value}`);
	}
	if (Array.isArray(value) || isPlainObject(value)) {
		if (seen.has(value))
			throw new TypeError(`The cache holds JSON: field ${field} holds a cycle`);
		seen.add(value);
		for (const item of Array.isArray(value) ? value : Object.values(value))
			assertJson(item, field, seen);
		// Left again: the same object twice, not nested in itself, is fine.
		seen.delete(value);
		return;
	}
	throw new TypeError(
		`The cache holds JSON: field ${field} holds ${kindOf(value)}`,
	);
}

/** What a non-JSON value is, for an error: `a Date`, `undefined`, `a function`. */
function kindOf(value: unknown): string {
	if (value === undefined) return 'undefined';
	if (typeof value !== 'object') return `a ${typeof value}`;
	const name = (value as { constructor?: { name?: unknown } }).constructor
		?.name;
	return typeof name === 'string' && name !== '' ? `a ${name}` : 'an object';
}

export function isReference(value: unknown): value is Reference {
	return (
		isPlainObject(value) &&
		typeof value['__ref'] === 'string' &&
		Object.keys(value).length === 1
	);
}

/**
 * Two stored values alike in every field: a write that changes nothing
 * notifies nobody. Arrays and plain objects compare by content; anything
 * else (a `Date`, a `Map`) by `Object.is`.
 */
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

/**
 * `extra`'s fields added into `target`: objects merged field by field, and
 * two lists of the same length item by item; otherwise `extra`'s value wins.
 */
export function deepMerge(target: StoreObject, extra: StoreObject): void {
	for (const [key, value] of Object.entries(extra))
		target[key] = merged(target[key], value);
}

function merged(current: unknown, value: unknown): unknown {
	if (isPlainObject(current) && isPlainObject(value)) {
		deepMerge(current, value);
		return current;
	}
	if (
		Array.isArray(current) &&
		Array.isArray(value) &&
		current.length === value.length
	)
		return current.map((item, index) => merged(item, value[index]));
	return value;
}
