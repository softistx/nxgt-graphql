import type { CacheKeys } from './types';

/**
 * An object's entity key, `<__typename>:<identity>`, or `undefined` when it
 * has none and is stored inside its parent. The identity is `keys` for its
 * type when given, else its `id`, else its `_id`.
 */
export function identify(
	fields: Readonly<Record<string, unknown>>,
	keys: CacheKeys | undefined,
): string | undefined {
	const typename = fields['__typename'];
	if (typeof typename !== 'string') return undefined;
	const custom =
		keys && Object.hasOwn(keys, typename) ? keys[typename] : undefined;
	if (custom) {
		const identity = custom(fields);
		return identity == null ? undefined : `${typename}:${identity}`;
	}
	const id = fields['id'] ?? fields['_id'];
	if (typeof id !== 'string' && typeof id !== 'number') return undefined;
	return `${typename}:${id}`;
}
