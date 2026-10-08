import { describe } from 'bun:test';
import { integerCases, scalarCases } from '../../../test/scalar-cases';
import { PositiveIntScalar } from './positive-int';

describe('PositiveInt', () => {
	integerCases(PositiveIntScalar);

	scalarCases(PositiveIntScalar, {
		accepted: [1, 2147483647],
		refused: [0, -1, 1.5, 2147483648, '1'],
	});
});
