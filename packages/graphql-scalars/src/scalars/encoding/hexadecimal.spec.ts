import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { HexadecimalScalar } from './hexadecimal';

describe('Hexadecimal', () => {
	scalarCases(HexadecimalScalar, {
		accepted: ['0', 'ab', 'AB', 'aB', 'abc', 'deadbeef'],
		refused: ['', '0x1f', 'g', 'ab cd', 1],
	});
});
