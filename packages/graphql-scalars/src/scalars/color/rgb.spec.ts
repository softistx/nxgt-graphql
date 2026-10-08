import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { RGBScalar } from './rgb';

describe('RGB', () => {
	scalarCases(RGBScalar, {
		accepted: ['rgb(255, 0, 0)', 'rgb(0, 0, 0)', 'rgb(12, 199, 250)'],
		refused: [
			'rgb(255, 0, 0)\n',
			'rgb(256, 0, 0)',
			'rgb(-1, 0, 0)',
			'rgb(01, 0, 0)',
			'rgb(255,0,0)',
			'rgb(255 0 0)',
			'rgb(100%, 0%, 0%)',
			'rgb(255, 0, 0, 0.5)',
			'RGB(255, 0, 0)',
			'rgb(255, 0, 0) ',
			'rgb(1.5, 0, 0)',
			'',
		],
	});
});
