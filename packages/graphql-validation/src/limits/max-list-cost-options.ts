/** Options of {@link maxListCost}. */
export interface MaxListCostOptions {
	/** The most an operation may cost (at least 0). */
	budget: number;
	/** The size of a list field whose size cannot be read (an integer of at least 0). */
	defaultFirst: number;
	/**
	 * The argument names that size a list. Each one given, or defaulted in the
	 * SDL, says a size (an Int, a canonical-integer string or an integral Float)
	 * and the largest wins. Default `['first', 'last', 'limit']`. One on a
	 * non-list field also sizes the lists declaring none directly on its return
	 * type (a Relay connection's `edges` and `nodes`).
	 */
	sizeArguments?: readonly string[];
	/**
	 * Do not cost `__schema` and `__type` (default `false`). Only where
	 * introspection is disabled or the client is trusted, e.g. GraphiQL in
	 * development: the standard introspection query is costly (on the order of
	 * 200,000 on a one-field schema).
	 */
	ignoreIntrospection?: boolean;
	/**
	 * What to assume for a size argument the client sends as a variable (or
	 * writes as an unusable literal) when it declares no `@constraint(max)`:
	 * an integer of at least 0. Validation has no variable values, and the
	 * client may send any value the argument accepts, so such a size counts as
	 * the largest of its SDL default (else `defaultFirst`), its declared
	 * `@constraint(max)`, and this. A declared max wins over this option. The
	 * operation's own variable default is ignored. Default: none.
	 */
	variableSize?: number;
}

export const DEFAULT_SIZE_ARGUMENTS = ['first', 'last', 'limit'] as const;
