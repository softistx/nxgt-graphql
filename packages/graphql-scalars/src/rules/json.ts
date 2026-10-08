/** How deep a JSON value may nest: past it, a value is refused, not walked. */
export const MAX_DEPTH = 1000;

/**
 * Whether `value` is what `JSON.stringify` writes back as it is: `null`, a
 * boolean, a string, a finite number, an array or a plain object of them.
 * A cycle, `undefined` (even as an object's field or an array's hole), a
 * `Date`, a `Map`, a class instance, `NaN`, `-0` (written `0`) or a
 * `bigint` is not. Nesting deeper than
 * {@link MAX_DEPTH} is refused, so a hostile value cannot overflow the stack.
 */
export function isJsonValue(value: unknown): boolean {
	return walk(value, new Set(), new Map(), 0);
}

/** Whether `value` is a plain object whose every field is a JSON value. */
export function isJsonObject(value: unknown): boolean {
	return isPlainObject(value) && isJsonValue(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

/**
 * `ancestors` holds the containers being walked, for a cycle; `checked`
 * the depth each container already passed at, so a shared one is walked
 * again only when it now sits deeper.
 */
function walk(
	value: unknown,
	ancestors: Set<object>,
	checked: Map<object, number>,
	depth: number,
): boolean {
	switch (typeof value) {
		case 'string':
		case 'boolean':
			return true;
		case 'number':
			return Number.isFinite(value) && !Object.is(value, -0);
		case 'object':
			break;
		default:
			return false;
	}
	if (value === null) return true;
	if (depth >= MAX_DEPTH || ancestors.has(value)) return false;
	const before = checked.get(value);
	if (before !== undefined && before >= depth) return true;
	const items = children(value);
	if (items === undefined) return false;
	ancestors.add(value);
	const ok = items.every((item) => walk(item, ancestors, checked, depth + 1));
	ancestors.delete(value);
	if (ok) checked.set(value, depth);
	return ok;
}

/**
 * A container's items, or `undefined` when it is no JSON container. An
 * array with a hole, which JSON would write `null`, has none: the loop stops
 * at the first hole rather than allocating the array's whole length.
 */
function children(value: object): unknown[] | undefined {
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) {
			if (!(index in value)) return undefined;
		}
		return value;
	}
	return isPlainObject(value) ? Object.values(value) : undefined;
}
