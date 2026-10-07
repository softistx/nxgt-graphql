import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { Cuid2Scalar } from './cuid2';

describe('Cuid2', () => {
	scalarCases(Cuid2Scalar, {
		accepted: ['tz4a98xxat96iws9zmbrgj3a', 'ab', `a${'0'.repeat(31)}`],
		refused: [
			'1abc',
			'a',
			'Tz4a98xxat96iws9zmbrgj3a',
			`a${'0'.repeat(32)}`,
			'tz4a98xx-t96iws9zmbrgj3a',
			'',
		],
	});
});
