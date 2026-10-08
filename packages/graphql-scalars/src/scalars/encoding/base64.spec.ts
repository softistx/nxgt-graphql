import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { Base64Scalar } from './base64';

describe('Base64', () => {
	scalarCases(Base64Scalar, {
		accepted: ['', 'YQ==', 'aGk=', 'aGVsbG8=', 'a+b/'],
		refused: ['aGl=', 'YR==', 'aGk', 'aGk==', 'a-b_', 'aG k=', 'aGk=\n', 1],
	});
});
