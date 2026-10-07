import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { Format } from '../src/formats/format';
import type { Target } from '../src/rules/rule';

/** Any rule, whatever its value and target. */
interface AnyRule {
	readonly argument: string;
	readonly target: Target;
	readonly toZod: (schema: never, value: never) => z.ZodType;
	readonly toCode: (schema: string, value: never) => string;
}

/** The schema a rule narrows in its cases, and the same as source. */
const bases: Record<Target, () => [z.ZodType, string]> = {
	string: () => [z.string(), 'z.string()'],
	number: () => [z.number(), 'z.number()'],
	list: () => [z.array(z.string()), 'z.array(z.string())'],
};

/** What a code generator's output becomes once it runs. */
function evaluate(code: string): z.ZodType {
	return new Function('z', `return ${code};`)(z);
}

interface Cases {
	accepts: readonly unknown[];
	rejects: readonly unknown[];
}

function agree(runtime: z.ZodType, generated: z.ZodType, cases: Cases): void {
	for (const input of cases.accepts) {
		test(`accepts ${JSON.stringify(input)}`, () => {
			expect(runtime.safeParse(input).success).toBe(true);
			expect(generated.safeParse(input).success).toBe(true);
		});
	}
	for (const input of cases.rejects) {
		test(`refuses ${JSON.stringify(input)}`, () => {
			expect(runtime.safeParse(input).success).toBe(false);
			expect(generated.safeParse(input).success).toBe(false);
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
		) => z.ZodType;
		const write = rule.toCode as (
			schema: string,
			value: string | number,
		) => string;
		agree(apply(base, value), evaluate(write(baseCode, value)), cases);
	});
}

/** The same promise for a format: its schema and its source agree. */
export function formatCases(format: Format, cases: Cases): void {
	describe(`@constraint(format: "${format.name}")`, () => {
		agree(format.toZod(), evaluate(format.toCode()), cases);
	});
}
