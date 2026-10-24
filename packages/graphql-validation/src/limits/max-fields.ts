import {
	type FragmentDefinitionNode,
	GraphQLError,
	type SelectionSetNode,
	type ValidationContext,
	type ValidationRule,
} from 'graphql';
import { assertInteger, operationLabel } from './describe';
import { isIntrospectionRoot } from './introspection';

/** Options of {@link maxFields}. */
export interface MaxFieldsOptions {
	/** The most field selections an operation may have (at least 1). */
	limit: number;
	/**
	 * Do not count `__schema` and `__type` (default `false`). Only where
	 * introspection is disabled or the client is trusted, e.g. GraphiQL in
	 * development: the standard introspection query (`getIntrospectionQuery()`)
	 * selects 220 fields.
	 */
	ignoreIntrospection?: boolean;
}

/** What a walk of one document needs: what it has counted so far. */
interface FieldsContext {
	getFragment: (name: string) => FragmentDefinitionNode | null | undefined;
	fragmentCounts: Map<string, number>;
	counting: Set<string>;
	ignoreIntrospection: boolean;
}

/** `a + b`, clamped where a count stops being exact. */
function add(a: number, b: number): number {
	return Math.min(a + b, Number.MAX_SAFE_INTEGER);
}

/** The field selections of `selectionSet`, nested ones included. */
function countOf(walk: FieldsContext, selectionSet: SelectionSetNode): number {
	let total = 0;
	for (const selection of selectionSet.selections) {
		if (selection.kind === 'Field') {
			if (walk.ignoreIntrospection && isIntrospectionRoot(selection.name.value))
				continue;
			total = add(total, 1);
			if (selection.selectionSet)
				total = add(total, countOf(walk, selection.selectionSet));
		} else if (selection.kind === 'InlineFragment') {
			total = add(total, countOf(walk, selection.selectionSet));
		} else {
			total = add(total, fragmentCount(walk, selection.name.value));
		}
	}
	return total;
}

/** The count of the named fragment, walked once. */
function fragmentCount(walk: FieldsContext, name: string): number {
	const known = walk.fragmentCounts.get(name);
	if (known !== undefined) return known;
	const fragment = walk.getFragment(name);
	// A cycle is NoFragmentCyclesRule's to report; here it adds nothing.
	if (!fragment || walk.counting.has(name)) return 0;
	walk.counting.add(name);
	const result = countOf(walk, fragment.selectionSet);
	walk.counting.delete(name);
	walk.fragmentCounts.set(name, result);
	return result;
}

/**
 * A graphql-js validation rule refusing an operation that selects more than
 * `limit` fields: neither `maxDepth` nor `maxListCost` bounds breadth, so
 * thousands of aliases of a cheap field (or of `__typename`) pass both.
 *
 * Every field node counts 1, aliases and `__typename` included. A named
 * fragment counts at each spread (walked once), an inline fragment counts its
 * contents, and every branch of a union counts: nothing is pruned by type.
 * `@skip` and `@include` are not evaluated, so the count can be over the
 * document's field count. It counts the document, spreads expanded, not what the
 * executor runs: how often a field runs inside a list is `maxListCost`'s.
 * One `GraphQLError` per operation, with
 * `extensions: { code: 'QUERY_TOO_WIDE', fields, limit }`, `fields` being the
 * operation's real count (clamped at `Number.MAX_SAFE_INTEGER`).
 *
 * ```ts
 * validate(schema, document, [...specifiedRules, maxFields({ limit: 500 })]);
 * // graphql-yoga: onValidate: ({ addValidationRule }) => addValidationRule(maxFields({ limit: 500 }))
 * ```
 */
export function maxFields(options: MaxFieldsOptions): ValidationRule {
	const limit = options.limit;
	assertInteger('maxFields: limit', limit, 1);
	return (context: ValidationContext) => {
		const walk: FieldsContext = {
			getFragment: (name) => context.getFragment(name),
			fragmentCounts: new Map(),
			counting: new Set(),
			ignoreIntrospection: options.ignoreIntrospection ?? false,
		};
		return {
			OperationDefinition(operation) {
				const fields = countOf(walk, operation.selectionSet);
				if (fields > limit) {
					context.reportError(
						new GraphQLError(
							`${operationLabel(operation)} selects ${fields} fields, more than the ${limit} allowed`,
							{
								nodes: [operation],
								extensions: { code: 'QUERY_TOO_WIDE', fields, limit },
							},
						),
					);
				}
				return false;
			},
		};
	};
}
