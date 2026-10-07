import { describe, expect, test } from 'bun:test';
import { Kind } from 'graphql';
import { integerCases, scalarCases } from '../../../test/scalar-cases';
import { LongScalar } from './long';

describe('Long', () => {
	integerCases(LongScalar);

	scalarCases(LongScalar, {
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
		expect(LongScalar.parseValue('9223372036854775807')).toBe(
			9223372036854775807n,
		);
		expect(LongScalar.parseValue(42)).toBe(42n);
		expect(LongScalar.serialize(-9223372036854775808n)).toBe(
			'-9223372036854775808',
		);
	});

	test('a number resolver result is refused: the resolver returns a bigint', () => {
		expect(() => LongScalar.serialize(42)).toThrow(
			'Long cannot serialize this value',
		);
	});

	test('a literal past 2^53 written as a number is refused, not rounded', () => {
		expect(() =>
			LongScalar.parseLiteral(
				{ kind: Kind.INT, value: '9007199254740993' },
				undefined,
			),
		).toThrow('Long cannot represent this input');
		expect(
			LongScalar.parseLiteral(
				{ kind: Kind.STRING, value: '9007199254740993' },
				undefined,
			),
		).toBe(9007199254740993n);
	});

	test('it holds to 64 bits, both ways', () => {
		expect(() => LongScalar.parseValue('9223372036854775808')).toThrow(
			'Long cannot represent this input',
		);
		expect(() => LongScalar.serialize(2n ** 63n)).toThrow(
			'Long cannot serialize this value',
		);
	});
});
