import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NonNegativeFloatScalar } from './non-negative-float';

describe('NonNegativeFloat', () => {
	scalarCases(NonNegativeFloatScalar, {
		accepted: [0, 0.5, 1],
		refused: [-0.5, Number.POSITIVE_INFINITY, Number.NaN, '0'],
	});
});
