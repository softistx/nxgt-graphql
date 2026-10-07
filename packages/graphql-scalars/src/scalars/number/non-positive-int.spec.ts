import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NonPositiveIntScalar } from './non-positive-int';

describe('NonPositiveInt', () => {
	scalarCases(NonPositiveIntScalar, {
		accepted: [0, -1, -2147483648],
		refused: [1, -1.5, -2147483649, '0'],
	});
});
