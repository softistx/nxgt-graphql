import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { SHA512Scalar } from './sha512';

describe('SHA512', () => {
	scalarCases(SHA512Scalar, {
		accepted: ['a'.repeat(128), 'F'.repeat(128), 'aF'.repeat(64)],
		refused: ['a'.repeat(127), 'a'.repeat(129), 'a'.repeat(64), ''],
	});
});
