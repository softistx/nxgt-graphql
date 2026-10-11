import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { ruleCases } from '../../test/rule-cases';
import { registryOf } from '../formats/registry';
import { formatRule } from './format';
import { constraintOf } from './index';
import { notContainsRule } from './not-contains';
import { RULE_PARAM } from './rule';

ruleCases(formatRule, 'email', { accepts: ['a@b.co'], rejects: ['a@', 'a'] });

const builtIns = { formats: registryOf() };

describe('@constraint(format: ...) with an unknown format', () => {
	test('fails at startup and names the known formats', () => {
		expect(() => formatRule.toZod(z.string(), 'siret', builtIns)).toThrow(
			'Unknown @constraint format "siret". Known formats: byte, date, date-time',
		);
	});
});

describe('@constraint(format: ...) with an application format', () => {
	const own = { formats: registryOf({ siret: z.string().regex(/^\d{14}$/) }) };

	test('resolves to its schema', () => {
		const schema = formatRule.toZod(z.string(), 'siret', own);
		expect(schema.safeParse('73282932000074').success).toBe(true);
		expect(schema.safeParse('7328').success).toBe(false);
	});

	test('has no source of its own: the code generator writes it', () => {
		expect(() => formatRule.toCode('z.string()', 'siret', own)).toThrow(
			`@constraint(format: "siret") is one of the application's formats: its source is the code generator's to write, through inputCode's format option.`,
		);
	});
});

describe("an application format's issue", () => {
	const own = registryOf({
		code: z
			.string()
			.length(6)
			.regex(/^[A-Z]/)
			.endsWith('X')
			.refine((value) => !value.includes('0'), 'No zero'),
	});
	const issuesOf = (value: string) =>
		formatRule.toZod(z.string(), 'code', { formats: own }).safeParse(value)
			.error?.issues ?? [];

	test("is format's whatever its code, even one a rule owns", () => {
		const issues = issuesOf('a0');
		expect(issues.map(({ code }) => code)).toEqual([
			'too_small',
			'invalid_format',
			'invalid_format',
			'custom',
		]);
		expect(issues.map(constraintOf)).toEqual([
			'format',
			'format',
			'format',
			'format',
		]);
	});

	test('keeps its code and message, and carries no input', () => {
		const [issue] = issuesOf('abcdeX');
		expect(issue).toMatchObject({
			code: 'invalid_format',
			format: 'regex',
			message: 'Invalid string: must match pattern /^[A-Z]/',
		});
		expect(issue && 'input' in issue).toBe(false);
	});

	test("leaves a rule's own issue to that rule", () => {
		const [issue] =
			notContainsRule.toZod(z.string(), 'x', builtIns).safeParse('axe').error
				?.issues ?? [];
		expect(issue?.code).toBe('custom');
		expect(issue && constraintOf(issue)).toBe('notContains');
		expect(RULE_PARAM).toBe('nxgtConstraint');
	});
});
