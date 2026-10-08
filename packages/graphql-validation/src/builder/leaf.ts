import {
	GraphQLFloat,
	GraphQLID,
	GraphQLInt,
	type GraphQLLeafType,
	GraphQLString,
} from 'graphql';
import { z } from 'zod';
import { applyRule } from '../rules';
import type { Target } from '../rules/rule';
import type { Constraint } from './constraints';

/** The kind of value each built-in scalar holds once graphql parsed it. */
const kinds: Record<string, Exclude<Target, 'list'>> = {
	[GraphQLString.name]: 'string',
	[GraphQLID.name]: 'string',
	[GraphQLInt.name]: 'number',
	[GraphQLFloat.name]: 'number',
};

function baseOf(type: GraphQLLeafType): z.ZodType {
	if (type.name === GraphQLInt.name) return z.number().int();
	return kinds[type.name] === 'number' ? z.number() : z.string();
}

/**
 * The schema of a scalar or enum value with its constraints applied. A leaf
 * without any is left as graphql parsed it. A constraint that cannot apply
 * — `minLength` on an `Int`, anything on a custom scalar or an enum — fails
 * here, at startup, naming `where`.
 */
export function leafSchema(
	type: GraphQLLeafType,
	constraints: readonly Constraint[],
	where: string,
): z.ZodType {
	if (constraints.length === 0) return z.unknown();
	const kind = kinds[type.name];
	let schema = baseOf(type);
	for (const { rule, value } of constraints) {
		if (rule.target !== kind) {
			throw new Error(
				`@constraint(${rule.argument}) on ${where} needs ${describeTarget(rule.target)}, not ${type.name}.`,
			);
		}
		schema = applyRule(rule, schema, value);
	}
	return schema;
}

/** What a rule's target reads as in an error. */
export function describeTarget(target: Target): string {
	if (target === 'string') return 'a String or an ID';
	if (target === 'number') return 'an Int or a Float';
	return 'a list';
}
