import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NegativeFloatScalar } from './negative-float';

describe('NegativeFloat', () => {
	scalarCases(NegativeFloatScalar, {
		accepted: [-0.5, -1, -Number.MAX_VALUE],
		refused: [0, -0, 0.5, Number.NEGATIVE_INFINITY, Number.NaN, '-1'],
	});
});
