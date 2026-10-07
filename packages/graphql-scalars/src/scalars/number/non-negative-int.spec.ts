import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NonNegativeIntScalar } from './non-negative-int';

describe('NonNegativeInt', () => {
	scalarCases(NonNegativeIntScalar, {
		accepted: [0, 1, 2147483647],
		refused: [-1, 1.5, 2147483648, '0'],
	});
});
