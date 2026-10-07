import { describe, expect, test } from 'bun:test';
import { parseValue } from 'graphql';
import { scalarCases } from '../../../test/scalar-cases';
import { DateTimeScalar } from './date-time';

describe('DateTime', () => {
	scalarCases(DateTimeScalar, {
		accepted: ['2024-03-10T12:00:00+02:00', '2024-03-10T10:00:00Z'],
		refused: ['2024-03-10T12:00:00', '2023-02-29T00:00:00Z', '2024-03-10'],
		passThrough: false,
	});

	test('decodes to a Date and encodes in UTC', () => {
		const date = DateTimeScalar.parseValue('2024-03-10T12:00:00+02:00');
		expect(date).toBeInstanceOf(Date);
		expect(date.getTime()).toBe(Date.UTC(2024, 2, 10, 10));
		expect(DateTimeScalar.serialize(date)).toBe('2024-03-10T10:00:00.000Z');
		expect(
			DateTimeScalar.parseLiteral(
				parseValue('"2024-03-10T10:00:00Z"'),
				undefined,
			),
		).toEqual(date);
	});

	test('refuses a bad Date on the way out', () => {
		expect(() => DateTimeScalar.serialize(new Date(Number.NaN))).toThrow(
			'DateTime cannot serialize this value: Invalid Date',
		);
	});

	test('serializes a Date only, not a string a resolver forgot to parse', () => {
		expect(() => DateTimeScalar.serialize('2024-03-10T10:00:00.000Z')).toThrow(
			'DateTime cannot serialize this value',
		);
	});
});
