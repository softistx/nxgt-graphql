import {
	GraphQLBoolean,
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
 * Fails unless every constraint applies to a value of `type`: `minLength` on
 * an `Int`, anything on a custom scalar or an enum, fails, naming `where`.
 * The runtime and the code generator refuse the same schemas with the same
 * message.
 */
export function assertLeafTargets(
	type: GraphQLLeafType,
	constraints: readonly Constraint[],
	where: string,
): void {
	const misplaced = constraints.find(({ rule }) => rule.target === 'list');
	if (misplaced) throw misplacedOn(misplaced, where, type.name);
	const kind = kinds[type.name];
	const wrong = constraints.find(({ rule }) => rule.target !== kind);
	if (wrong) throw misplacedOn(wrong, where, type.name);
}

/** Fails when an input object carries a constraint: none applies to it. */
export function assertObjectTargets(
	typeName: string,
	constraints: readonly Constraint[],
	where: string,
): void {
	const first =
		constraints.find(({ rule }) => rule.target === 'list') ?? constraints[0];
	if (first) throw misplacedOn(first, where, typeName);
}

function misplacedOn(
	{ rule }: Constraint,
	where: string,
	typeName: string,
): Error {
	return new Error(
		`@constraint(${rule.argument}) on ${where} needs ${describeTarget(rule.target)}, not ${typeName}.`,
	);
}

/**
 * The schema of a scalar or enum value with its constraints applied. A leaf
 * without any is left as graphql parsed it. A constraint that cannot apply
 * fails here, at startup.
 */
export function leafSchema(
	type: GraphQLLeafType,
	constraints: readonly Constraint[],
	where: string,
): z.ZodType {
	if (constraints.length === 0) return z.unknown();
	assertLeafTargets(type, constraints, where);
	let schema = baseOf(type);
	for (const { rule, value } of constraints) {
		schema = applyRule(rule, schema, value);
	}
	return schema;
}

/** The source of a built-in scalar's schema, before its constraints. */
export function baseCode(type: GraphQLLeafType): string | undefined {
	if (type.name === GraphQLInt.name) return 'z.number().int()';
	if (type.name === GraphQLFloat.name) return 'z.number()';
	if (type.name === GraphQLBoolean.name) return 'z.boolean()';
	return kinds[type.name] === 'string' ? 'z.string()' : undefined;
}

/** What a rule's target reads as in an error. */
export function describeTarget(target: Target): string {
	if (target === 'string') return 'a String or an ID';
	if (target === 'number') return 'an Int or a Float';
	return 'a list';
}
