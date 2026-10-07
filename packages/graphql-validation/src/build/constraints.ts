import {
	type DirectiveNode,
	type GraphQLDirective,
	getDirectiveValues,
} from 'graphql';
import { type RegisteredRule, rules } from '../rules';

/** One `@constraint` argument written on an argument or an input field. */
export interface Constraint {
	readonly rule: RegisteredRule;
	readonly value: string | number;
}

/**
 * The constraints written on a node, base rules (`format`) first so the
 * others narrow the schema they produce. Empty when the schema declares no
 * `@constraint` or the node carries none.
 */
export function constraintsOn(
	directive: GraphQLDirective | undefined,
	node:
		| { readonly directives?: ReadonlyArray<DirectiveNode> | undefined }
		| null
		| undefined,
): Constraint[] {
	if (!directive || !node) return [];
	const values = getDirectiveValues(directive, node) ?? {};
	return Object.entries(values)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([argument, value]) => ({
			rule: rules[argument as keyof typeof rules],
			value: value as string | number,
		}))
		.sort(
			(a, b) => Number(Boolean(b.rule.base)) - Number(Boolean(a.rule.base)),
		);
}
