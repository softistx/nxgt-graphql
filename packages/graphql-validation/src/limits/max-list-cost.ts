import {
	type FragmentDefinitionNode,
	GraphQLError,
	type GraphQLField,
	type GraphQLNamedType,
	type GraphQLSchema,
	getNamedType,
	getNullableType,
	isInterfaceType,
	isListType,
	isObjectType,
	type OperationDefinitionNode,
	type SelectionSetNode,
	type ValidationContext,
	type ValidationRule,
} from 'graphql';
import { assertInteger, operationLabel } from './describe';
import {
	introspectionRoot,
	introspectionSize,
	isIntrospectionRoot,
} from './introspection';
import { listSize, type SizeContext } from './list-size';

/** Options of {@link maxListCost}. */
export interface MaxListCostOptions {
	/** The most an operation may cost (at least 0). */
	budget: number;
	/** The size of a list field whose size cannot be read (an integer of at least 0). */
	defaultFirst: number;
	/**
	 * The argument names that size a list. Each one given, or defaulted in the
	 * SDL, says a size (an Int, a canonical-integer string or an integral Float)
	 * and the largest wins. Default `['first', 'last', 'limit']`.
	 */
	sizeArguments?: readonly string[];
	/**
	 * Do not cost `__schema` and `__type` (default `false`). Only where
	 * introspection is disabled or the client is trusted, e.g. GraphiQL in
	 * development: the standard introspection query is costly (about 185,000 on a one-field schema).
	 */
	ignoreIntrospection?: boolean;
}

const DEFAULT_SIZE_ARGUMENTS = ['first', 'last', 'limit'] as const;

/** Costs are plain numbers, held below this so a hostile query never reaches `Infinity`. */
const CEILING = Number.MAX_SAFE_INTEGER;

const add = (a: number, b: number) => Math.min(CEILING, a + b);
const multiply = (a: number, b: number) => Math.min(CEILING, a * b);

/** What a walk of one document needs: the options, and what it has measured so far. */
interface CostContext extends SizeContext {
	ignoreIntrospection: boolean;
	getFragment: (name: string) => FragmentDefinitionNode | null | undefined;
	fragmentCosts: Map<string, number>;
	costing: Set<string>;
}

/** The definition of the field `name` on `parent`, meta-fields of the query root included. */
function fieldOf(
	cost: CostContext,
	parent: GraphQLNamedType | undefined,
	name: string,
): GraphQLField<unknown, unknown> | undefined {
	if (parent === cost.schema.getQueryType() && isIntrospectionRoot(name)) {
		return introspectionRoot(name);
	}
	return isObjectType(parent) || isInterfaceType(parent)
		? parent.getFields()[name]
		: undefined;
}

/** The cost of `selectionSet` selected on `parent`. */
function costOf(
	cost: CostContext,
	selectionSet: SelectionSetNode,
	parent: GraphQLNamedType | undefined,
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
			let inner = 0;
			if (selection.selectionSet) {
				inner = costOf(
					cost,
					selection.selectionSet,
					getNamedType(definition.type),
				);
				if (isListType(getNullableType(definition.type))) {
					const size = parent?.name.startsWith('__')
						? introspectionSize(cost.schema, name)
						: listSize(cost, parent, definition, selection.arguments);
					inner = multiply(inner, size);
				}
			}
			total = add(total, add(1, inner));
		} else if (selection.kind === 'InlineFragment') {
			const condition = selection.typeCondition
				? cost.schema.getType(selection.typeCondition.name.value)
				: parent;
			total = add(total, costOf(cost, selection.selectionSet, condition));
		} else {
			total = add(total, fragmentCost(cost, selection.name.value));
		}
	}
	return total;
}

/** The cost of the named fragment, computed once. */
function fragmentCost(cost: CostContext, name: string): number {
	const known = cost.fragmentCosts.get(name);
	if (known !== undefined) return known;
	const fragment = cost.getFragment(name);
	// A cycle is NoFragmentCyclesRule's to report; here it adds nothing.
	if (!fragment || cost.costing.has(name)) return 0;
	cost.costing.add(name);
	const result = costOf(
		cost,
		fragment.selectionSet,
		cost.schema.getType(fragment.typeCondition.name.value),
	);
	cost.costing.delete(name);
	cost.fragmentCosts.set(name, result);
	return result;
}

/** The type an operation selects on. */
function rootType(schema: GraphQLSchema, operation: OperationDefinitionNode) {
	const type =
		operation.operation === 'query'
			? schema.getQueryType()
			: operation.operation === 'mutation'
				? schema.getMutationType()
				: schema.getSubscriptionType();
	return type ?? undefined;
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
 * Named fragments are followed, each costed once. Inline fragments and
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
	// A copy: a caller changing its array later must not desync the schema cache keyed by it.
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
