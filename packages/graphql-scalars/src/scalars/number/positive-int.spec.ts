import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { PositiveIntScalar } from './positive-int';

describe('PositiveInt', () => {
	scalarCases(PositiveIntScalar, {
		accepted: [1, 2147483647],
		refused: [0, -1, 1.5, 2147483648, '1'],
	});
});
