import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { ruleCases } from '../../test/rule-cases';
import { formatRule } from './format';

ruleCases(formatRule, 'email', { accepts: ['a@b.co'], rejects: ['a@', 'a'] });

describe('@constraint(format: ...) with an unknown format', () => {
	test('fails at startup and names the known formats', () => {
		expect(() => formatRule.toZod(z.string(), 'siret')).toThrow(
			'Unknown @constraint format "siret". Known formats: byte, date, date-time',
		);
	});
});
