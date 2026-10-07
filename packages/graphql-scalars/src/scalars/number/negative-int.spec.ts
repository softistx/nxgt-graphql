import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NegativeIntScalar } from './negative-int';

describe('NegativeInt', () => {
	scalarCases(NegativeIntScalar, {
		accepted: [-1, -2147483648],
		refused: [0, 1, -1.5, -2147483649, '-1'],
	});
});
