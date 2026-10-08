import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { UUIDv4Scalar } from './uuidv4';

describe('UUIDv4', () => {
	scalarCases(UUIDv4Scalar, {
		accepted: [
			'123e4567-e89b-42d3-a456-426614174000',
			'123E4567-E89B-42D3-A456-426614174000',
			'123e4567-E89B-42d3-a456-426614174000',
		],
		refused: [
			'017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
			'123e4567-e89b-12d3-a456-426614174000',
			'123e4567-e89b-42d3-c456-426614174000',
			'00000000-0000-0000-0000-000000000000',
			'ffffffff-ffff-ffff-ffff-ffffffffffff',
			'',
		],
	});
});
