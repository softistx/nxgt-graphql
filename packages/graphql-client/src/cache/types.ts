import type { GraphQLDocument } from '../document';

/**
 * Each interface and union with the object types it stands for, as
 * graphql-codegen's `fragment-matcher` plugin writes it:
 * `{ Node: ['User', 'Book'], SearchResult: ['User', 'Book'] }`. With it, a
 * fragment on an abstract type matches exactly the types listed.
 */
export type PossibleTypes = Readonly<Record<string, readonly string[]>>;

/**
 * An entity's identity within its type, per `__typename`, read from the
 * object's fields by their names (aliases resolved): `null` stores the
 * object inside its parent instead. The entity's key is
 * `<__typename>:<identity>`.
 */
export type CacheKeys = Readonly<
	Record<string, (object: Readonly<Record<string, unknown>>) => string | null>
>;

export interface NormalizedCacheOptions {
	/** The abstract types' members, for fragments on interfaces and unions. */
	possibleTypes?: PossibleTypes;
	/** Identities other than `id` (or `_id`), per `__typename`. */
	keys?: CacheKeys;
}

/**
 * An entity: its key (`'Book:1'`), or an object holding its `__typename`
 * and the fields its identity reads (`{ __typename: 'Book', id: '1' }`).
 */
export type EntityRef =
	| string
	| { readonly __typename: string; readonly [field: string]: unknown };

/**
 * Takes a field's stored value and returns the next one; `undefined`
 * removes the field, so the next read that needs it goes to the network.
 * A field holding an entity holds `{ __ref: '<key>' }`.
 */
export type FieldModifier = (current: unknown) => unknown;

/**
 * The variables then one more argument (the data, the callback): the
 * variables may be left out when the document requires none.
 */
export type VariablesThen<TVariables, TLast> =
	Record<string, never> extends TVariables
		? [last: TLast] | [variables: TVariables | undefined, last: TLast]
		: [variables: TVariables, last: TLast];

/** Which fragment of a fragment document, and its variables, if it reads any. */
export interface FragmentOptions {
	/** The fragment to read. Default: the document's first, the one the client preset defines. */
	readonly fragmentName?: string;
	/** The variables its fields' arguments read. */
	readonly variables?: Readonly<Record<string, unknown>>;
}

/**
 * Where results are kept between calls, entity by entity. The client
 * writes every query's and mutation's result to it, and serves
 * `cache-first` queries from it.
 */
export interface GraphQLCache {
	/** The document's result as the cache holds it, or `undefined` when any field is missing. */
	read<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: Record<string, never> extends TVariables
			? [variables?: NoInfer<TVariables>]
			: [variables: NoInfer<TVariables>]
	): TResult | undefined;
	/**
	 * Stores a result for the document, as the server would send it: every
	 * object carries its `__typename`. All or nothing: a write that throws
	 * (a `keys` function) changes nothing.
	 */
	write<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: VariablesThen<NoInfer<TVariables>, NoInfer<TResult>>
	): void;
	/**
	 * Calls `callback` with the document's result read afresh (`undefined`
	 * when incomplete) after a write, evict, modify or reset that changed
	 * it: once per change, never for another entity, nor when the fields it
	 * reads came out equal. A callback that throws is reported
	 * (`reportError`), not thrown into the write. Returns the function that
	 * stops it. The hook for UI bindings.
	 */
	watch<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		...args: VariablesThen<
			NoInfer<TVariables>,
			(data: NoInfer<TResult> | undefined) => void
		>
	): () => void;
	/**
	 * One entity's fields through a fragment document (`fragment BookCard on
	 * Book { title }`), or `undefined` when any is missing or the ref names
	 * no entity.
	 */
	readFragment<TResult>(
		fragment: GraphQLDocument<TResult, never>,
		ref: EntityRef,
		options?: FragmentOptions,
	): TResult | undefined;
	/** `watch` for a fragment on one entity: the hook for `useFragment`. */
	watchFragment<TResult>(
		fragment: GraphQLDocument<TResult, never>,
		ref: EntityRef,
		callback: (data: NoInfer<TResult> | undefined) => void,
		options?: FragmentOptions,
	): () => void;
	/** Removes an entity; `false` when the cache did not hold it. */
	evict(ref: EntityRef): boolean;
	/**
	 * Rewrites an entity's fields: a modifier named `books` applies to
	 * every stored `books(…)`, one named `books({"first":10})` to that one
	 * alone. `false` when the cache did not hold the entity.
	 */
	modify(
		ref: EntityRef,
		fields: Readonly<Record<string, FieldModifier>>,
	): boolean;
	/** Empties the cache: every watch whose result was whole is called back. */
	reset(): void;
}
