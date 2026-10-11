import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { BuiltInFormat } from '../src/formats/format';
import { registryOf } from '../src/formats/registry';
import { rules } from '../src/rules';
import type { IssueFields, RuleContext, Target } from '../src/rules/rule';

/** Any rule, whatever its value and target. */
interface AnyRule {
	readonly argument: string;
	readonly target: Target;
	readonly toZod: (schema: never, value: never, context: never) => z.ZodType;
	readonly toCode: (schema: string, value: never, context: never) => string;
	readonly owns: (issue: IssueFields) => boolean;
}

/** The schema a rule narrows in its cases, and the same as source. */
const bases: Record<Target, () => [z.ZodType, string]> = {
	string: () => [z.string(), 'z.string()'],
	number: () => [z.number(), 'z.number()'],
	list: () => [z.array(z.string()), 'z.array(z.string())'],
};

/** The built-in formats only, as a schema with no `formats` option has. */
const context: RuleContext = { formats: registryOf() };

/** What a code generator's output becomes once it runs. */
function evaluate(code: string): z.ZodType {
	return new Function('z', `return ${code};`)(z);
}

interface Cases {
	accepts: readonly unknown[];
	rejects: readonly unknown[];
}

function agree(
	runtime: z.ZodType,
	generated: z.ZodType,
	cases: Cases,
	rule?: AnyRule,
): void {
	for (const input of cases.accepts) {
		test(`accepts ${JSON.stringify(input)}`, () => {
			expect(runtime.safeParse(input).success).toBe(true);
			expect(generated.safeParse(input).success).toBe(true);
		});
	}
	for (const input of cases.rejects) {
		test(`refuses ${JSON.stringify(input)}`, () => {
			const result = runtime.safeParse(input);
			expect(result.success).toBe(false);
			expect(generated.safeParse(input).success).toBe(false);
			// The refusal names this rule, and no other: a client maps on it. A
			// value of the wrong type is graphql's to refuse, not a rule's.
			const issue = result.error?.issues[0] as unknown as IssueFields;
			if (rule && issue.code !== 'invalid_type') {
				const owners: string[] = Object.values(rules)
					.filter((one) => one.owns(issue))
					.map((one) => one.argument);
				expect(owners).toEqual([rule.argument]);
			}
		});
	}
}

/**
 * The cases of one rule with one value: `toZod` and the source `toCode`
 * writes must accept and refuse exactly the same inputs, or a code generator
 * would ship a rule the runtime does not enforce.
 */
export function ruleCases(
	rule: AnyRule,
	value: string | number,
	cases: Cases,
): void {
	describe(`@constraint(${rule.argument}: ${JSON.stringify(value)})`, () => {
		const [base, baseCode] = bases[rule.target]();
		const apply = rule.toZod as (
			schema: z.ZodType,
			value: string | number,
			context: RuleContext,
		) => z.ZodType;
		const write = rule.toCode as (
			schema: string,
			value: string | number,
			context: RuleContext,
		) => string;
		agree(
			apply(base, value, context),
			evaluate(write(baseCode, value, context)),
			cases,
			rule,
		);
	});
}

/** The same promise for a format: its schema and its source agree. */
export function formatCases(format: BuiltInFormat, cases: Cases): void {
	describe(`@constraint(format: "${format.name}")`, () => {
		agree(format.toZod(), evaluate(format.toCode()), cases);
	});
}
