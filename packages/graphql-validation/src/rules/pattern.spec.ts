import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { ruleCases } from '../../test/rule-cases';
import { registryOf } from '../formats/registry';
import { patternRule } from './pattern';

ruleCases(patternRule, '^[a-z]+\\d?$', {
	accepts: ['abc', 'abc1'],
	rejects: ['ABC', 'abc12', ''],
});

describe('@constraint(pattern: ...) that is not a regular expression', () => {
	test('fails at startup and names the pattern', () => {
		expect(() =>
			patternRule.toZod(z.string(), '[a-', { formats: registryOf() }),
		).toThrow('Invalid @constraint pattern "[a-": ');
	});
});
