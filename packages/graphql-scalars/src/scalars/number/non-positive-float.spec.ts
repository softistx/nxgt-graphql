import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NonPositiveFloatScalar } from './non-positive-float';

describe('NonPositiveFloat', () => {
	scalarCases(NonPositiveFloatScalar, {
		accepted: [0, -0.5, -1],
		refused: [0.5, Number.NEGATIVE_INFINITY, Number.NaN, '0'],
	});
});
