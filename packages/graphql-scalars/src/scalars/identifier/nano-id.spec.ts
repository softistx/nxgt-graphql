import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NanoIDScalar } from './nano-id';

describe('NanoID', () => {
	scalarCases(NanoIDScalar, {
		accepted: ['V1StGXR8_Z5jdHi6B-myT', '___________________-_'],
		refused: [
			'V1StGXR8_Z5jdHi6B-my',
			'V1StGXR8_Z5jdHi6B-myTT',
			'V1StGXR8_Z5jdHi6B-my!',
			'',
		],
	});
});
