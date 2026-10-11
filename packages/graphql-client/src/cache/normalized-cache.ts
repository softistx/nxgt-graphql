import { type GraphQLDocument, operationOf } from '../document';
import { identify } from './identity';
import { readResult } from './read';
import {
	type CacheDocument,
	cacheDocumentOf,
	variablesOf,
	type Walk,
} from './selection';
import { EntityStore } from './store';
import { type TypeMatcher, typeMatcher } from './type-match';
import { withTypename } from './typename';
import type {
	CacheKeys,
	EntityRef,
	FieldModifier,
	GraphQLCache,
	NormalizedCacheOptions,
} from './types';
import type { Watch } from './watchers';
import { Watchers } from './watchers';
import { writeResult } from './write';

type AnyDocument = GraphQLDocument<unknown, never>;

/**
 * A normalized cache for `createGraphQLClient({ cache })`: each object with
 * a `__typename` and an `id` (or `_id`, or the identity `keys` gives its
 * type) is stored once, and every result holding it reads its latest
 * fields. Meant for a browser: on a server, where one client serves one
 * request, leave the cache off.
 *
 * ```ts
 * const client = createGraphQLClient({
 *   url: '/graphql',
 *   cache: normalizedCache({ possibleTypes, keys: { Book: (book) => String(book.isbn) } }),
 * });
 * ```
 */
export function normalizedCache(
	options: NormalizedCacheOptions = {},
): GraphQLCache {
	return new NormalizedCache(options) as unknown as GraphQLCache;
}

class NormalizedCache {
	readonly #store = new EntityStore();
	readonly #watchers = new Watchers();
	readonly #keys: CacheKeys | undefined;
	readonly #matches: TypeMatcher;

	constructor({ possibleTypes, keys }: NormalizedCacheOptions) {
		this.#keys = keys;
		this.#matches = typeMatcher(possibleTypes);
	}

	read(document: AnyDocument, variables?: unknown): unknown {
		return readResult(this.#walk(document, variables), this.#store).data;
	}

	write(document: AnyDocument, variables: unknown, data: unknown): void {
		const walk = this.#walk(document, variables);
		try {
			writeResult({ ...walk, store: this.#store, keys: this.#keys }, data);
		} finally {
			this.#flush();
		}
	}

	watch(
		document: AnyDocument,
		variables: unknown,
		callback: (data: unknown) => void,
	): () => void {
		const walk = this.#walk(document, variables);
		const watch: Watch = {
			deps: readResult(walk, this.#store).deps,
			refresh: () => {
				const { data, deps } = readResult(walk, this.#store);
				watch.deps = deps;
				callback(data);
			},
		};
		return this.#watchers.add(watch);
	}

	evict(ref: EntityRef): boolean {
		const key = this.#keyOf(ref);
		const evicted = key !== undefined && this.#store.evict(key);
		this.#flush();
		return evicted;
	}

	modify(
		ref: EntityRef,
		fields: Readonly<Record<string, FieldModifier>>,
	): boolean {
		const key = this.#keyOf(ref);
		try {
			return key !== undefined && this.#store.modify(key, fields);
		} finally {
			this.#flush();
		}
	}

	reset(): void {
		this.#store.clear();
		this.#flush();
	}

	#keyOf(ref: EntityRef): string | undefined {
		return typeof ref === 'string' ? ref : identify(ref, this.#keys);
	}

	#walk(document: AnyDocument, variables: unknown): Walk {
		const cacheDocument = documentOf(document);
		return {
			document: cacheDocument,
			variables: variablesOf(cacheDocument.operation, variables),
			matches: this.#matches,
		};
	}

	/** Calls back the watches the batch of changes just made touched. */
	#flush(): void {
		this.#watchers.notify(this.#store.takeChanges());
	}
}

/** The document as the client sends it to a cache: `__typename` everywhere. */
function documentOf(document: AnyDocument): CacheDocument {
	return cacheDocumentOf(withTypename(operationOf(document).node));
}
