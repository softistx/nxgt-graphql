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
	 * object carries its `__typename`.
	 */
	write<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		variables: NoInfer<TVariables>,
		data: NoInfer<TResult>,
	): void;
	/**
	 * Calls `callback` with the document's result read afresh (`undefined`
	 * when incomplete) after each write, evict, modify or reset that changed
	 * a field the last read used: once per change, never for another
	 * entity. Returns the function that stops it. The hook for UI bindings.
	 */
	watch<TResult, TVariables>(
		document: GraphQLDocument<TResult, TVariables>,
		variables: NoInfer<TVariables>,
		callback: (data: TResult | undefined) => void,
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
	/** Empties the cache: every watcher is called back. */
	reset(): void;
}
