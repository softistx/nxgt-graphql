import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { GUIDScalar } from './guid';

describe('GUID', () => {
	scalarCases(GUIDScalar, {
		accepted: [
			'123e4567-e89b-12d3-a456-426614174000',
			'ABCDEF01-2345-6789-ABCD-EF0123456789',
			'00000000-0000-0000-0000-000000000000',
			'abcdef01-2345-6789-ABCD-ef0123456789',
			'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
		],
		refused: [
			'{123e4567-e89b-12d3-a456-426614174000}',
			'GGGGGGGG-0000-0000-0000-000000000000',
			'123e4567e89b12d3a456426614174000',
			'',
			1,
		],
	});
});
