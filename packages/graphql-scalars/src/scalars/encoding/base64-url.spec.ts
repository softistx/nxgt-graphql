import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { Base64URLScalar } from './base64-url';

describe('Base64URL', () => {
	scalarCases(Base64URLScalar, {
		accepted: ['', 'YQ', 'aGk', 'a-b_'],
		refused: ['aGl', 'A', 'aGVsb', 'YR', 'aGk=', 'a+b/', 'a b', 1],
	});
});
