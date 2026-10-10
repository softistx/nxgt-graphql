import { describe, expect, test } from 'bun:test';
import { Kind } from 'graphql';
import { integerCases, scalarCases } from '../../../test/scalar-cases';
import { BigIntScalar } from './big-int';

describe('BigInt', () => {
	integerCases(BigIntScalar);

	scalarCases(BigIntScalar, {
		accepted: ['0', '-1', '9223372036854775807', '-9223372036854775808', 42],
		refused: [
			'007',
			'-0',
			'1.5',
			'1e3',
			' 1',
			'',
			1.5,
			2 ** 53,
			true,
			null,
			5n,
		],
		passThrough: false,
	});

	test('a string becomes a bigint, and a bigint goes out as its string', () => {
		expect(BigIntScalar.parseValue('9223372036854775807')).toBe(
			9223372036854775807n,
		);
		expect(BigIntScalar.parseValue(42)).toBe(42n);
		expect(BigIntScalar.serialize(-9223372036854775808n)).toBe(
			'-9223372036854775808',
		);
	});

	test('a resolver may return the wire form, a safe number or a string', () => {
		expect(BigIntScalar.serialize(42)).toBe('42');
		expect(BigIntScalar.serialize('42')).toBe('42');
		expect(() => BigIntScalar.serialize(1.5)).toThrow(
			'BigInt cannot serialize this value',
		);
		expect(() => BigIntScalar.serialize(2 ** 60)).toThrow(
			'BigInt cannot serialize this value',
		);
	});

	test('a literal past 2^53 written as a number is refused, not rounded', () => {
		const hint = 'Invalid integer: past 2^53, write it as a string';
		expect(() =>
			BigIntScalar.parseLiteral(
				{ kind: Kind.INT, value: '9007199254740993' },
				undefined,
			),
		).toThrow(`BigInt cannot represent this input: ${hint}`);
		expect(() => BigIntScalar.parseValue(2 ** 53)).toThrow(
			`BigInt cannot represent this input: ${hint}`,
		);
		expect(() => BigIntScalar.parseValue(-(2 ** 53))).toThrow(
			`BigInt cannot represent this input: ${hint}`,
		);
		expect(
			BigIntScalar.parseLiteral(
				{ kind: Kind.STRING, value: '9007199254740993' },
				undefined,
			),
		).toBe(9007199254740993n);
	});

	test('it has no bound', () => {
		expect(BigIntScalar.parseValue('123456789012345678901234567890')).toBe(
			123456789012345678901234567890n,
		);
		expect(BigIntScalar.serialize(-(10n ** 40n))).toBe(`-1${'0'.repeat(40)}`);
	});
});
