import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { PortScalar } from './port';

describe('Port', () => {
	scalarCases(PortScalar, {
		accepted: [0, 80, 65535],
		refused: [-1, 65536, 80.5, '80'],
	});
});
