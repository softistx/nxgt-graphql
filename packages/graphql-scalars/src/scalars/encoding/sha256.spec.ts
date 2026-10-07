import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { SHA256Scalar } from './sha256';

describe('SHA256', () => {
	scalarCases(SHA256Scalar, {
		accepted: [
			'a'.repeat(64),
			'A'.repeat(64),
			`${'0'.repeat(32)}${'f'.repeat(32)}`,
		],
		refused: [
			'a'.repeat(63),
			'a'.repeat(65),
			'g'.repeat(64),
			'a'.repeat(128),
			'',
		],
	});
});
