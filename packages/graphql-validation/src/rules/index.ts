import type { z } from 'zod';
import * as all from './all';
import { type IssueFields, RULE_PARAM, type RuleContext } from './rule';

/**
 * One of the rules, as its own type: a builder narrows it on `target`, so a
 * number schema never reaches a string rule.
 */
export type RegisteredRule = (typeof all)[keyof typeof all];

/** An argument `@constraint` takes. */
export type ConstraintArgument = RegisteredRule['argument'];

/**
 * Every rule, keyed by its `@constraint` argument. Derived from what
 * `./all` exports, so a new rule is one file and one line there, and the
 * directive's SDL follows.
 */
export const rules = Object.fromEntries(
	Object.values(all).map((rule) => [rule.argument, rule]),
) as {
	readonly [A in ConstraintArgument]: Extract<RegisteredRule, { argument: A }>;
};

/**
 * Applies a rule to a schema its caller has already matched to the rule's
 * target: the one place the rule's typed `toZod` meets a schema built from
 * GraphQL types, which the compiler cannot relate.
 */
export function applyRule(
	rule: RegisteredRule,
	schema: z.ZodType,
	value: string | number,
	context: RuleContext,
): z.ZodType {
	const toZod = rule.toZod as unknown as (
		schema: z.ZodType,
		value: string | number,
		context: RuleContext,
	) => z.ZodType;
	return toZod(schema, value, context);
}

/** `applyRule` for source: the rule's typed `toCode` on a schema's source. */
export function applyRuleCode(
	rule: RegisteredRule,
	source: string,
	value: string | number,
	context: RuleContext,
): string {
	const toCode = rule.toCode as (
		schema: string,
		value: string | number,
		context: RuleContext,
	) => string;
	return toCode(source, value, context);
}

/**
 * The `@constraint` argument whose rule refused with this issue, if any: the
 * one the issue is marked with (an application format's), else the one rule
 * that owns its shape.
 */
export function constraintOf(
	issue: z.core.$ZodIssue,
): ConstraintArgument | undefined {
	const fields = issue as unknown as IssueFields;
	const marked = fields.params?.[RULE_PARAM];
	if (typeof marked === 'string' && Object.hasOwn(rules, marked))
		return marked as ConstraintArgument;
	return Object.values(rules).find((rule) => rule.owns(fields))?.argument;
}
