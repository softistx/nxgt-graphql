import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { PositiveFloatScalar } from './positive-float';

describe('PositiveFloat', () => {
	scalarCases(PositiveFloatScalar, {
		accepted: [0.5, 1, Number.MAX_VALUE],
		refused: [0, -0, -0.5, Number.POSITIVE_INFINITY, Number.NaN, '1'],
	});
});
