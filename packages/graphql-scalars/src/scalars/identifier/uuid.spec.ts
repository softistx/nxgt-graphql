import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { UUIDScalar } from './uuid';

describe('UUID', () => {
	scalarCases(UUIDScalar, {
		accepted: [
			'550e8400-e29b-41d4-a716-446655440000',
			'550E8400-E29B-41D4-A716-446655440000',
			'550e8400-E29B-41d4-a716-446655440000',
			'017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
			'00000000-0000-0000-0000-000000000000',
			'ffffffff-ffff-ffff-ffff-ffffffffffff',
			'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
		],
		refused: [
			'550e8400e29b41d4a716446655440000',
			// Version 0 or 9, and a variant that is not `10`.
			'550e8400-e29b-01d4-a716-446655440000',
			'550e8400-e29b-91d4-a716-446655440000',
			'550e8400-e29b-41d4-c716-446655440000',
			'{550e8400-e29b-41d4-a716-446655440000}',
			'not-a-uuid',
			'',
			1,
		],
	});
});
