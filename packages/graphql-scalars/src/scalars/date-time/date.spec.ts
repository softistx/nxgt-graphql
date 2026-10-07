import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { DateScalar } from './date';

describe('Date', () => {
	scalarCases(DateScalar, {
		accepted: ['2024-02-29', '1999-12-31'],
		refused: ['2023-02-29', '2024-2-1', '2024-01-01T00:00:00Z', 20240101],
	});
});
