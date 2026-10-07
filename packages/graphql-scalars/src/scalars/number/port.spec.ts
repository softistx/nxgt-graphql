import { describe } from 'bun:test';
import { integerCases, scalarCases } from '../../../test/scalar-cases';
import { PortScalar } from './port';

describe('Port', () => {
	integerCases(PortScalar);

	scalarCases(PortScalar, {
		accepted: [0, 80, 65535],
		refused: [-1, 65536, 80.5, '80'],
	});
});
