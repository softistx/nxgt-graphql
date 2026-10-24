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
	fragmentCosts: Map<string, number>;
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
