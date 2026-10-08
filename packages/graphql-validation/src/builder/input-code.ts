import {
	type GraphQLInputType,
	type GraphQLNamedInputType,
	isInputObjectType,
	isListType,
	isNonNullType,
} from 'graphql';
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
): string {
	if (isNonNullType(type))
		return requiredCode(type.ofType, constraints, where, named);
	return `${requiredCode(type, constraints, where, named)}.nullish()`;
}

function requiredCode(
	type: GraphQLInputType,
	constraints: readonly Constraint[],
	where: string,
	named: (type: GraphQLNamedInputType) => string,
): string {
	if (isNonNullType(type))
		return requiredCode(type.ofType, constraints, where, named);
	if (isListType(type)) {
		// minItems and maxItems are the list's; every other rule is its items'.
		const own = constraints.filter(({ rule }) => rule.target === 'list');
		const items = constraints.filter(({ rule }) => rule.target !== 'list');
		return applyCode(
			`z.array(${inputCode(type.ofType, items, where, named)})`,
			own,
		);
	}
	if (isInputObjectType(type)) {
		assertObjectTargets(type.name, constraints, where);
		return named(type);
	}
	assertLeafTargets(type, constraints, where);
	return applyCode(baseCode(type) ?? named(type), constraints);
}

function applyCode(source: string, constraints: readonly Constraint[]): string {
	return constraints.reduce(
		(code, { rule, value }) =>
			(rule.toCode as (schema: string, value: string | number) => string)(
				code,
				value,
			),
		source,
	);
}
