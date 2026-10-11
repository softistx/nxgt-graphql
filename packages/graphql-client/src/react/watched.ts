import { useMemo, useSyncExternalStore } from 'react';
import { equal } from '../cache/values';

/** A cache read and the watch that keeps it current. */
export interface WatchedRead<T> {
	read(): T | undefined;
	watch(callback: (data: T | undefined) => void): () => void;
}

interface Store<T> {
	get(): T | undefined;
	subscribe(onChange: () => void): () => void;
}

const nothing = () => undefined;
const noSubscription = () => () => {};

/**
 * What a cache read holds now, the component rendered again whenever its
 * watch calls back. The snapshot is the object the watch last delivered, so
 * it keeps its identity between renders, as `useSyncExternalStore` needs.
 * `source` must be memoized by its caller: a new one reads afresh.
 */
export function useWatched<T>(
	source: WatchedRead<T> | undefined,
): T | undefined {
	const store = useMemo(() => source && storeOf(source), [source]);
	const get = store?.get ?? nothing;
	return useSyncExternalStore(store?.subscribe ?? noSubscription, get, get);
}

function storeOf<T>(source: WatchedRead<T>): Store<T> {
	let current = source.read();
	return {
		get: () => current,
		subscribe(onChange) {
			const stop = source.watch((data) => {
				current = data;
				onChange();
			});
			// A write between the first read and the watch: the watch compares
			// with what it read itself, so it would never call back for it.
			const now = source.read();
			if (!equal(now, current)) {
				current = now;
				onChange();
			}
			return stop;
		},
	};
}
