import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { KSUIDScalar } from './ksuid';

describe('KSUID', () => {
	scalarCases(KSUIDScalar, {
		accepted: [
			'aWgEPTl1tmebfsQzFP4bxwgy80V',
			'000000000000000000000000000',
			'0ujtsYcgvSTl8PAuAdqWYSMnLOv',
		],
		refused: [
			'aWgEPTl1tmebfsQzFP4bxwgy80W',
			'zzzzzzzzzzzzzzzzzzzzzzzzzzz',
			'0ujtsYcgvSTl8PAuAdqWYSMnLO',
			'0ujtsYcgvSTl8PAuAdqWYSMnLOv0',
			'0ujtsYcgvSTl8PAuAdqWYSMnLO-',
			'',
		],
	});
});
