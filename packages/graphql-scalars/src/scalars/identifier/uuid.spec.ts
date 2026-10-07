import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { UUIDScalar } from './uuid';

describe('UUID', () => {
	scalarCases(UUIDScalar, {
		accepted: [
			'550e8400-e29b-41d4-a716-446655440000',
			'00000000-0000-0000-0000-000000000000',
		],
		refused: ['550e8400e29b41d4a716446655440000', 'not-a-uuid', 1],
	});
});
