import { describe, expect, test } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { IPScalar } from './ip';

describe('IP', () => {
	scalarCases(IPScalar, {
		accepted: ['192.168.0.1', '::1', '2001:db8::1'],
		refused: ['256.0.0.1', 'example.com', '', 1],
	});

	test('its refusal says what it takes, for any input', () => {
		for (const value of ['x', 1, null]) {
			expect(() => IPScalar.parseValue(value)).toThrow(
				'IP cannot represent this input: Invalid IP address: expected IPv4 or IPv6',
			);
		}
	});
});
