import {
	type ArgumentNode,
	GraphQLError,
	type GraphQLField,
	type GraphQLNamedType,
	getNamedType,
	getNullableType,
	isInterfaceType,
	isListType,
	isObjectType,
	type SelectionSetNode,
	type ValidationContext,
	type ValidationRule,
} from 'graphql';
import { assertInteger, operationLabel } from './describe';

/** Options of {@link maxListCost}. */
export interface MaxListCostOptions {
	/** The most an operation may cost (at least 0). */
	budget: number;
	/** The size of a list field whose size cannot be read (an integer of at least 0). */
	defaultFirst: number;
	/** The argument names that size a list, the first present wins. Default `['first', 'last', 'limit']`. */
	sizeArguments?: readonly string[];
}

const DEFAULT_SIZE_ARGUMENTS = ['first', 'last', 'limit'] as const;

/** Costs are plain numbers, held below this so a hostile query never reaches `Infinity`. */
const CEILING = Number.MAX_SAFE_INTEGER;

const add = (a: number, b: number) => Math.min(CEILING, a + b);
const multiply = (a: number, b: number) => Math.min(CEILING, a * b);

/** A non-negative integer, or `undefined`. */
function sizeOf(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
		? value
		: undefined;
}

/**
 * A graphql-js validation rule refusing an operation whose cost is more than
 * `budget`, to stop a client from exploiting list cycles (`Folder.items`,
 * `Item.folder`, `Folder.items`, …) for a cost growing exponentially.
 *
 * The cost of an operation is the sum, over every selected field, of the
 * product of the sizes of the list fields enclosing it: a field costs 1, and a
 * list field multiplies the cost of its sub-selection by its size.
 * Introspection meta-fields (`__typename`, `__schema`, `__type`) cost nothing.
 *
 * The size of a list field is the first of `sizeArguments` (default `first`,
 * `last`, `limit`) given on the field. A literal Int of at least 0 is used as
 * it is. Anything else (a negative literal, a variable, since validation has no
 * variable values, or no size argument) uses the argument's SDL default value
 * when it is a non-negative Int, and `defaultFirst` otherwise. Hence no
 * subtree ever costs less than nothing: a negative `first` on one field cannot
 * cancel the cost of its sibling. A field whose type (once unwrapped from
 * non-null) is a list is one list, nested `[[X]]` included.
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
	const sizeArguments = options.sizeArguments ?? DEFAULT_SIZE_ARGUMENTS;
	assertInteger('maxListCost: budget', budget, 0);
	assertInteger('maxListCost: defaultFirst', defaultFirst, 0);

	return (context: ValidationContext) => {
		const schema = context.getSchema();
		const fragmentCosts = new Map<string, number>();
		const costing = new Set<string>();

		/** The size of the list `definition` returns, as selected by `args`. */
		const listSize = (
			definition: GraphQLField<unknown, unknown>,
			args: readonly ArgumentNode[] | undefined,
		): number => {
			const given = sizeArguments.find((name) =>
				args?.some((arg) => arg.name.value === name),
			);
			const node = args?.find((arg) => arg.name.value === given);
			if (node?.value.kind === 'IntValue') {
				const literal = sizeOf(Number(node.value.value));
				if (literal !== undefined) return literal;
			}
			// Not a usable literal: the argument given, else the first one the
			// field declares, tells its default.
			const names = given ? [given] : sizeArguments;
			for (const name of names) {
				const declared = definition.args.find((arg) => arg.name === name);
				const fallback = sizeOf(declared?.defaultValue);
				if (fallback !== undefined) return fallback;
			}
			return defaultFirst;
		};

		const costOf = (
			selectionSet: SelectionSetNode,
			parent: GraphQLNamedType | undefined,
		): number => {
			let total = 0;
			for (const selection of selectionSet.selections) {
				if (selection.kind === 'Field') {
					if (selection.name.value.startsWith('__')) continue;
					const definition =
						isObjectType(parent) || isInterfaceType(parent)
							? parent.getFields()[selection.name.value]
							: undefined;
					// An unknown field is another rule's to report.
					if (!definition) continue;
					let inner = 0;
					if (selection.selectionSet) {
						inner = costOf(
							selection.selectionSet,
							getNamedType(definition.type),
						);
						if (isListType(getNullableType(definition.type))) {
							inner = multiply(
								inner,
								listSize(definition, selection.arguments),
							);
						}
					}
					total = add(total, add(1, inner));
				} else if (selection.kind === 'InlineFragment') {
					const condition = selection.typeCondition
						? schema.getType(selection.typeCondition.name.value)
						: parent;
					total = add(total, costOf(selection.selectionSet, condition));
				} else {
					total = add(total, fragmentCost(selection.name.value));
				}
			}
			return total;
		};

		const fragmentCost = (name: string): number => {
			const known = fragmentCosts.get(name);
			if (known !== undefined) return known;
			const fragment = context.getFragment(name);
			// A cycle is NoFragmentCyclesRule's to report; here it adds nothing.
			if (!fragment || costing.has(name)) return 0;
			costing.add(name);
			const cost = costOf(
				fragment.selectionSet,
				schema.getType(fragment.typeCondition.name.value),
			);
			costing.delete(name);
			fragmentCosts.set(name, cost);
			return cost;
		};

		return {
			OperationDefinition(operation) {
				const root =
					operation.operation === 'query'
						? schema.getQueryType()
						: operation.operation === 'mutation'
							? schema.getMutationType()
							: schema.getSubscriptionType();
				const cost = costOf(operation.selectionSet, root ?? undefined);
				if (cost > budget) {
					context.reportError(
						new GraphQLError(
							`${operationLabel(operation)} costs ${cost}, more than the ${budget} allowed`,
							{
								nodes: [operation],
								extensions: { code: 'QUERY_TOO_COSTLY', cost, limit: budget },
							},
						),
					);
				}
				return false;
			},
		};
	};
}
