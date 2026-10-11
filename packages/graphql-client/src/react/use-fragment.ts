import { useMemo } from 'react';
import { stableJson } from '../cache/field-key';
import type { EntityRef, FragmentOptions } from '../cache/types';
import type { GraphQLDocument } from '../document';
import { useClient } from './context';
import { useStable } from './stable';
import { useWatched, type WatchedRead } from './watched';

export const noFragmentCache =
	'useFragment() reads the cache: pass cache: normalizedCache() to createGraphQLClient';

/**
 * One entity's fields through a fragment document, read from the cache and
 * kept current by `watchFragment`: `undefined` while any field is missing,
 * or when `ref` is `null` or `undefined`. It never sends a request. The ref
 * and the options are compared by value.
 */
export function useFragment<TResult>(
	fragment: GraphQLDocument<TResult, never>,
	ref: EntityRef | null | undefined,
	options?: FragmentOptions,
): TResult | undefined {
	const { cache } = useClient();
	if (!cache) throw new Error(noFragmentCache);
	const entity = useStable(ref, stableJson(ref ?? null));
	const fragmentOptions = useStable(options, stableJson(options ?? null));
	const source = useMemo<WatchedRead<TResult> | undefined>(() => {
		if (entity === null || entity === undefined) return undefined;
		return {
			read: () => cache.readFragment(fragment, entity, fragmentOptions),
			watch: (callback) =>
				cache.watchFragment(fragment, entity, callback, fragmentOptions),
		};
	}, [cache, fragment, entity, fragmentOptions]);
	return useWatched(source);
}
