import {
	type FieldNode,
	GraphQLError,
	type GraphQLField,
	type GraphQLNamedType,
	getNamedType,
	getNullableType,
	isListType,
	type SelectionSetNode,
	type ValidationContext,
	type ValidationRule,
} from 'graphql';
import {
	add,
	type CostContext,
	fieldOf,
	memoSize,
	multiply,
	NO_PENDING,
	rootType,
} from './cost-context';
import { assertInteger, operationLabel } from './describe';
import { introspectionSize, isIntrospectionRoot } from './introspection';
import { statedSize } from './list-size';
import { listSizeUnder } from './pending-size';

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
}

const DEFAULT_SIZE_ARGUMENTS = ['first', 'last', 'limit'] as const;

/**
 * The cost of one selected field. `pending` is the size of the field whose
 * return type this selection is on: only a list declaring no size argument
 * takes it, and no field passes it on.
 */
function fieldCost(
	cost: CostContext,
	parent: GraphQLNamedType | undefined,
	selection: FieldNode,
	definition: GraphQLField<unknown, unknown>,
	pending: number | undefined,
): number {
	if (!selection.selectionSet) return 1;
	const name = selection.name.value;
	const type = getNamedType(definition.type);
	if (!isListType(getNullableType(definition.type))) {
		// An object field hands its own size, if it states one, to the lists
		// selected directly on it; the pending size stops here.
		const stated = statedSize(cost, parent, definition, selection.arguments);
		const inner = costOf(cost, selection.selectionSet, type, stated);
		return add(1, inner);
	}
	const inner = costOf(cost, selection.selectionSet, type, undefined);
	const size = parent?.name.startsWith('__')
		? introspectionSize(cost.schema, name)
		: listSizeUnder(cost, parent, definition, selection.arguments, pending);
	return add(1, multiply(inner, size));
}

/** The cost of `selectionSet` selected on `parent`, under the `pending` size of the field they are selected on. */
function costOf(
	cost: CostContext,
	selectionSet: SelectionSetNode,
	parent: GraphQLNamedType | undefined,
	pending: number | undefined,
): number {
	let total = 0;
	for (const selection of selectionSet.selections) {
		if (selection.kind === 'Field') {
			const name = selection.name.value;
			if (name === '__typename') continue;
			if (isIntrospectionRoot(name) && cost.ignoreIntrospection) continue;
			const definition = fieldOf(cost, parent, name);
			// An unknown field is another rule's to report.
			if (!definition) continue;
			total = add(
				total,
				fieldCost(cost, parent, selection, definition, pending),
			);
		} else if (selection.kind === 'InlineFragment') {
			const condition = selection.typeCondition
				? cost.schema.getType(selection.typeCondition.name.value)
				: parent;
			total = add(
				total,
				costOf(cost, selection.selectionSet, condition, pending),
			);
		} else {
			total = add(total, fragmentCost(cost, selection.name.value, pending));
		}
	}
	return total;
}

/** The cost of the named fragment spread under `pending`, computed once per size. */
function fragmentCost(
	cost: CostContext,
	name: string,
	pending: number | undefined,
): number {
	let known = cost.fragmentCosts.get(name);
	if (!known) {
		known = new Map();
		cost.fragmentCosts.set(name, known);
	}
	const size = memoSize(known, pending);
	const key = size ?? NO_PENDING;
	const memo = known.get(key);
	if (memo !== undefined) return memo;
	const fragment = cost.getFragment(name);
	// A cycle is NoFragmentCyclesRule's to report; here it adds nothing.
	if (!fragment || cost.costing.has(name)) return 0;
	cost.costing.add(name);
	const result = costOf(
		cost,
		fragment.selectionSet,
		cost.schema.getType(fragment.typeCondition.name.value),
		size,
	);
	cost.costing.delete(name);
	known.set(key, result);
	return result;
}

/**
 * A graphql-js validation rule refusing an operation whose cost is more than
 * `budget`, to stop a client from exploiting list cycles (`Folder.items`,
 * `Item.folder`, `Folder.items`, …) for a cost growing exponentially.
 *
 * The cost of an operation is the sum, over every selected field, of the
 * product of the sizes of the list fields enclosing it: a field costs 1, and a
 * list field multiplies the cost of its sub-selection by its size.
 * `__typename` costs nothing. `__schema` and `__type` are costed like any
 * field, their lists sized by the schema itself (`__Schema.types` is the number
 * of types, the other lists the longest list anywhere in the schema), unless
 * `ignoreIntrospection` is set.
 *
 * The size of a list field is the largest size its `sizeArguments` (default
 * `first`, `last`, `limit`) say. A literal Int, a String holding a canonical
 * integer (`"1000"`) or an integral Float (`1e3`) of at least 0 says that
 * number. Anything else (a negative literal, a variable, since validation has
 * no variable values) says the argument's SDL default when it has a usable one,
 * `defaultFirst` otherwise; an argument not given says its SDL default, or
 * nothing. When nothing is said the size is `defaultFirst`. On an interface the
 * largest default over its possible types is used. Hence no subtree ever costs
 * less than nothing: a negative `first` on one field cannot cancel the cost of
 * its sibling. A field whose type (once unwrapped from non-null) is a list is
 * one list, nested `[[X]]` included.
 *
 * A Relay connection puts the size on a field returning an object, with the
 * list below it (`items(first: 100) { edges { node { id } } }`). A field that
 * is not a list and states a size (by the same reading) hands it to the lists
 * selected directly on its return type, through inline fragments and fragment
 * spreads on that same selection set, and only to those declaring none of the
 * size arguments (`edges`, `nodes`): such a list takes it instead of
 * `defaultFirst`. A list declaring a size argument (`recent(first: Int)`)
 * reads its own, never the pending size. Crossing any other field (an object
 * field, `pageInfo`, a wrapper) ends it. A connection stating nothing hands
 * down nothing: its lists are sized `defaultFirst`.
 *
 * Named fragments are followed, each costed once per pending size (past eight
 * distinct sizes under one fragment a size is rounded up to a power of two, so
 * the work stays linear in the document and a cost only over-counts). Inline fragments and
 * fragments on an abstract type are summed branch by branch, so the cost of a
 * query on an interface or a union is overestimated, never underestimated.
 *
 * One `GraphQLError` per operation, with
 * `extensions: { code: 'QUERY_TOO_COSTLY', cost, limit }`. `cost` is exact up
 * to `Number.MAX_SAFE_INTEGER`, which it never exceeds.
 *
 * ```ts
 * const rule = maxListCost({ budget: 10_000, defaultFirst: 50 });
 * validate(schema, document, [...specifiedRules, rule]);
 * // graphql-yoga: onValidate: ({ addValidationRule }) => addValidationRule(rule)
 * ```
 */
export function maxListCost(options: MaxListCostOptions): ValidationRule {
	const { budget, defaultFirst } = options;
	// A copy: a caller changing its array later must not desync the schema
	// cache keyed by it.
	const sizeArguments = Object.freeze([
		...(options.sizeArguments ?? DEFAULT_SIZE_ARGUMENTS),
	]);
	assertInteger('maxListCost: budget', budget, 0);
	assertInteger('maxListCost: defaultFirst', defaultFirst, 0);

	return (context: ValidationContext) => {
		const schema = context.getSchema();
		const cost: CostContext = {
			schema,
			sizeArguments,
			defaultFirst,
			ignoreIntrospection: options.ignoreIntrospection ?? false,
			getFragment: (name) => context.getFragment(name),
			fragmentCosts: new Map(),
			costing: new Set(),
		};
		return {
			OperationDefinition(operation) {
				const total = costOf(
					cost,
					operation.selectionSet,
					rootType(schema, operation),
					undefined,
				);
				if (total > budget) {
					context.reportError(
						new GraphQLError(
							`${operationLabel(operation)} costs ${total}, more than the ${budget} allowed`,
							{
								nodes: [operation],
								extensions: {
									code: 'QUERY_TOO_COSTLY',
									cost: total,
									limit: budget,
								},
							},
						),
					);
				}
				return false;
			},
		};
	};
}
