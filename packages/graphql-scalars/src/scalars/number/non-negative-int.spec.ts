import { describe } from 'bun:test';
import { integerCases, scalarCases } from '../../../test/scalar-cases';
import { NonNegativeIntScalar } from './non-negative-int';

describe('NonNegativeInt', () => {
	integerCases(NonNegativeIntScalar);

	scalarCases(NonNegativeIntScalar, {
		accepted: [0, 1, 2147483647],
		refused: [-1, 1.5, 2147483648, '0'],
	});
});
