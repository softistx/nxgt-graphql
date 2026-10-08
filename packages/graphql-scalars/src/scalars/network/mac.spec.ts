import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { MACScalar } from './mac';

describe('MAC', () => {
	scalarCases(MACScalar, {
		accepted: ['00:1a:2b:3c:4d:5e', '00:1A:2B:3C:4D:5E', '00:1a:2B:3c:4D:5e'],
		refused: [
			'00:1a:2b:3c:4d:5g',
			'00:1a:2b-3c:4d:5e',
			'00-1a-2b-3c-4d-5e',
			'001a.2b3c.4d5e',
			'00:1a:2b:3c:4d',
			'',
		],
	});
});
