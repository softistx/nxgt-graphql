import { describe, expect, test } from 'bun:test';
import { integerCases, scalarCases } from '../../../test/scalar-cases';
import { TimestampScalar } from './timestamp';

describe('Timestamp', () => {
	integerCases(TimestampScalar);

	scalarCases(TimestampScalar, {
		accepted: [0, 1710065730000, -1, 8.64e15, -8.64e15],
		refused: [1.5, 8.64e15 + 1, '1710065730000', '2024-03-10T10:15:30Z', null],
		passThrough: false,
	});

	test('milliseconds become a Date, and a Date goes out as its milliseconds', () => {
		expect(TimestampScalar.parseValue(1710065730000)).toEqual(
			new Date('2024-03-10T10:15:30.000Z'),
		);
		expect(
			TimestampScalar.serialize(new Date('1969-12-31T23:59:59.999Z')),
		).toBe(-1);
	});

	test('a resolver result that is not a valid Date is refused', () => {
		expect(() => TimestampScalar.serialize(new Date(Number.NaN))).toThrow(
			'Timestamp cannot serialize this value: Invalid Date',
		);
		expect(() => TimestampScalar.serialize(1710065730000)).toThrow(
			'Timestamp cannot serialize this value',
		);
	});
});
