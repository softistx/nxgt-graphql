import { fragmentNodeOf, type GraphQLDocument, operationOf } from '../document';
import { logError } from '../report';
import { Dependencies } from './changes';
import { identify } from './identity';
import { type ReadResult, readEntity, readResult } from './read';
import {
	type CacheDocument,
	cacheDocumentOf,
	fragmentDocumentOf,
	variablesOf,
	type Walk,
} from './selection';
import { EntityStore, StagedWrites } from './store';
import { type TypeMatcher, typeMatcher } from './type-match';
import { withTypename } from './typename';
import type {
	CacheKeys,
	EntityRef,
	FieldModifier,
	FragmentOptions,
	GraphQLCache,
	NormalizedCacheOptions,
	VariablesThen,
} from './types';
import { equal } from './values';
import { type Watch, Watchers } from './watchers';
import { writeResult } from './write';

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
	return new NormalizedCache(options);
}

class NormalizedCache implements GraphQLCache {
	readonly onError: (error: unknown) => void;
	readonly #store = new EntityStore();
	readonly #watchers: Watchers;
	readonly #keys: CacheKeys | undefined;
	readonly #matches: TypeMatcher;

	constructor({ possibleTypes, keys, onError }: NormalizedCacheOptions) {
		this.onError = onError ?? logError;
		this.#watchers = new Watchers(this.onError);
		this.#keys = keys;
		this.#matches = typeMatcher(possibleTypes);
	}

	read<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...[variables]: Record<string, never> extends TVariables
			? [variables?: NoInfer<TVariables>]
			: [variables: NoInfer<TVariables>]
	): TResult | undefined {
		return readResult(this.#walk(document, variables), this.#store).data as
			| TResult
			| undefined;
	}

	/** Staged, then applied whole: a write that throws changes nothing. */
	write<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: VariablesThen<NoInfer<TVariables>, NoInfer<TResult>>
	): void {
		const [variables, data] = split(args);
		const staged = new StagedWrites(this.#store);
		const walk = this.#walk(document, variables);
		writeResult({ ...walk, store: staged, keys: this.#keys }, data);
		staged.commit();
		this.#flush();
	}

	watch<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: VariablesThen<
			NoInfer<TVariables>,
			(data: NoInfer<TResult> | undefined) => void
		>
	): () => void {
		const [variables, callback] = split(args);
		const walk = this.#walk(document, variables);
		return this.#watchRead(
			() => readResult(walk, this.#store),
			callback as (data: unknown) => void,
		);
	}

	readFragment<TResult>(
		fragment: GraphQLDocument<TResult, never>,
		ref: EntityRef,
		options?: FragmentOptions,
	): TResult | undefined {
		return this.#fragmentRead(fragment, ref, options)().data as
			| TResult
			| undefined;
	}

	watchFragment<TResult>(
		fragment: GraphQLDocument<TResult, never>,
		ref: EntityRef,
		callback: (data: NoInfer<TResult> | undefined) => void,
		options?: FragmentOptions,
	): () => void {
		return this.#watchRead(
			this.#fragmentRead(fragment, ref, options),
			callback as (data: unknown) => void,
		);
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
		// All or nothing: a modifier that throws changed nothing to flush.
		const modified = key !== undefined && this.#store.modify(key, fields);
		this.#flush();
		return modified;
	}

	reset(): void {
		this.#store.clear();
		this.#flush();
	}

	#keyOf(ref: EntityRef): string | undefined {
		return typeof ref === 'string' ? ref : identify(ref, this.#keys);
	}

	#walk(document: GraphQLDocument<unknown, never>, variables: unknown): Walk {
		const cacheDocument = documentOf(document);
		return {
			document: cacheDocument,
			variables: variablesOf(cacheDocument.operation, variables),
			matches: this.#matches,
		};
	}

	/** The read a fragment stands for: its entity through its selection set. */
	#fragmentRead(
		fragment: GraphQLDocument<unknown, never>,
		ref: EntityRef,
		options: FragmentOptions = {},
	): () => ReadResult {
		const node = withTypename(fragmentNodeOf(fragment));
		const document = fragmentDocumentOf(node, options.fragmentName);
		const walk = {
			document,
			variables: { ...options.variables },
			matches: this.#matches,
		};
		const key = this.#keyOf(ref);
		const set = document.fragment.selectionSet;
		return () =>
			key === undefined
				? { data: undefined, deps: new Dependencies() }
				: readEntity(walk, this.#store, key, set);
	}

	/**
	 * A watch over a read: called back only when what it reads changed. The
	 * last result is kept as a copy, so a callback that changes the object
	 * it got does not change what the next read is compared with.
	 */
	#watchRead(
		read: () => ReadResult,
		callback: (data: unknown) => void,
	): () => void {
		const first = read();
		let last: unknown = structuredClone(first.data);
		const watch: Watch = {
			deps: first.deps,
			refresh: () => {
				const { data, deps } = read();
				watch.deps = deps;
				if (equal(data, last)) return;
				last = structuredClone(data);
				callback(data);
			},
		};
		return this.#watchers.add(watch);
	}

	/** Calls back the watches the batch of changes just made touched. */
	#flush(): void {
		this.#watchers.notify(this.#store.takeChanges());
	}
}

/** The variables and the last argument, the variables left out or not. */
function split<TVariables, TLast>(
	args: VariablesThen<TVariables, TLast>,
): [TVariables | undefined, TLast] {
	return args.length === 1 ? [undefined, args[0]] : args;
}

/** The document as the client sends it to a cache: `__typename` everywhere. */
function documentOf(document: GraphQLDocument<unknown, never>): CacheDocument {
	return cacheDocumentOf(withTypename(operationOf(document).node));
}
