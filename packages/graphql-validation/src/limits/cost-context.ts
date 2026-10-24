import {
	type FragmentDefinitionNode,
	type GraphQLField,
	type GraphQLNamedType,
	type GraphQLSchema,
	isInterfaceType,
	isObjectType,
	type OperationDefinitionNode,
} from 'graphql';
import { introspectionRoot, isIntrospectionRoot } from './introspection';
import type { SizeContext } from './list-size';

/** Costs are plain numbers, held below this so a hostile query never reaches `Infinity`. */
const CEILING = Number.MAX_SAFE_INTEGER;

export const add = (a: number, b: number) => Math.min(CEILING, a + b);
export const multiply = (a: number, b: number) => Math.min(CEILING, a * b);

/** What a walk of one document needs: the options, and what it has measured so far. */
export interface CostContext extends SizeContext {
	ignoreIntrospection: boolean;
	getFragment: (name: string) => FragmentDefinitionNode | null | undefined;
	fragmentCosts: Map<string, Map<number, number>>;
	costing: Set<string>;
}

/** The definition of the field `name` on `parent`, meta-fields of the query root included. */
export function fieldOf(
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

/** The type an operation selects on. */
export function rootType(
	schema: GraphQLSchema,
	operation: OperationDefinitionNode,
) {
	const type =
		operation.operation === 'query'
			? schema.getQueryType()
			: operation.operation === 'mutation'
				? schema.getMutationType()
				: schema.getSubscriptionType();
	return type ?? undefined;
}

/** Distinct pending sizes costed exactly per fragment; further ones are rounded up. */
const EXACT_SIZES = 8;

/** The key a fragment is memoized under: `-1` for no pending size. */
export const NO_PENDING = -1;

/**
 * The pending size a fragment is costed under. A fragment spread under many
 * distinct sizes would be costed once per size, quadratic in a hostile
 * document; past `EXACT_SIZES` of them a new size is rounded up to a power of
 * two (a cost never lowers as a size grows, so it only over-counts, by less
 * than twice), which leaves at most `EXACT_SIZES` + 53 costings per fragment.
 */
export function memoSize(
	known: ReadonlyMap<number, number>,
	pending: number | undefined,
): number | undefined {
	if (pending === undefined || known.has(pending) || known.size < EXACT_SIZES) {
		return pending;
	}
	// Math.log2 rounds near 2^k + d, so the power is checked, not trusted.
	let rounded = 2 ** Math.ceil(Math.log2(Math.max(pending, 1)));
	if (rounded < pending) rounded *= 2;
	return Math.min(CEILING, rounded);
}
