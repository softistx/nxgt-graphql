import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { UUIDv7Scalar } from './uuidv7';

describe('UUIDv7', () => {
	scalarCases(UUIDv7Scalar, {
		accepted: ['017f22e2-79b0-7cc3-98c4-dc0c0c07398f'],
		refused: [
			'123e4567-e89b-42d3-a456-426614174000',
			'017f22e2-79b0-7cc3-c8c4-dc0c0c07398f',
			'',
		],
	});
});
