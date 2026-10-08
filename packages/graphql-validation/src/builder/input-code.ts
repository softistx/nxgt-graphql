import {
	type GraphQLInputType,
	type GraphQLList,
	type GraphQLNamedInputType,
	isInputObjectType,
	isListType,
	isNonNullType,
} from 'graphql';
import { applyRuleCode } from '../rules';
import type { Constraint } from './constraints';
import { assertLeafTargets, assertObjectTargets, baseCode } from './leaf';

/**
 * The source of the schema of one argument or input field: what
 * `InputSchemas` builds at startup, written for a code generator. The
 * source names zod as a free `z`.
 *
 * The runtime leaves what graphql already checked to graphql; generated
 * code checks every value, so each named type comes from `named`: an input
 * object's or an enum's schema by name, a custom scalar's from a mapping.
 * The built-in scalars are written here, with their constraints. A
 * constraint that cannot apply fails as it does at startup.
 */
export function inputCode(
	type: GraphQLInputType,
	constraints: readonly Constraint[],
	where: string,
	named: (type: GraphQLNamedInputType) => string,
	options: InputCodeOptions = {},
): string {
	const write: Write = { where, named, options };
	return typedCode(write, type, constraints);
}

/** How `inputCode` writes what a generator may want written otherwise. */
export interface InputCodeOptions {
	/**
	 * A list's schema, given its `type`, `code` (the array with every rule)
	 * and `single` (one item, non-null, without rules): to take a single
	 * value for a list, as graphql does, `single` wrapped then piped into
	 * `code`. Default: `code`.
	 */
	readonly list?: (list: {
		readonly type: GraphQLList<GraphQLInputType>;
		readonly code: string;
		readonly single: string;
	}) => string;
}

interface Write {
	readonly where: string;
	readonly named: (type: GraphQLNamedInputType) => string;
	readonly options: InputCodeOptions;
}

function typedCode(
	write: Write,
	type: GraphQLInputType,
	constraints: readonly Constraint[],
): string {
	if (isNonNullType(type)) return requiredCode(write, type.ofType, constraints);
	return `${requiredCode(write, type, constraints)}.nullish()`;
}

function requiredCode(
	write: Write,
	type: GraphQLInputType,
	constraints: readonly Constraint[],
): string {
	if (isNonNullType(type)) return requiredCode(write, type.ofType, constraints);
	if (isListType(type)) {
		// minItems and maxItems are the list's; every other rule is its items'.
		const own = constraints.filter(({ rule }) => rule.target === 'list');
		const items = constraints.filter(({ rule }) => rule.target !== 'list');
		const code = applyCode(
			`z.array(${typedCode(write, type.ofType, items)})`,
			own,
		);
		if (!write.options.list) return code;
		const single = requiredCode(write, type.ofType, []);
		return write.options.list({ type, code, single });
	}
	if (isInputObjectType(type)) {
		assertObjectTargets(type.name, constraints, write.where);
		return write.named(type);
	}
	assertLeafTargets(type, constraints, write.where);
	return applyCode(baseCode(type) ?? write.named(type), constraints);
}

function applyCode(source: string, constraints: readonly Constraint[]): string {
	return constraints.reduce(
		(code, { rule, value }) => applyRuleCode(rule, code, value),
		source,
	);
}
