import { describe } from 'bun:test';
import { integerCases, scalarCases } from '../../../test/scalar-cases';
import { NegativeIntScalar } from './negative-int';

describe('NegativeInt', () => {
	integerCases(NegativeIntScalar);

	scalarCases(NegativeIntScalar, {
		accepted: [-1, -2147483648],
		refused: [0, 1, -1.5, -2147483649, '-1'],
	});
});
