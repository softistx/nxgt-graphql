import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { HSLScalar } from './hsl';

describe('HSL', () => {
	scalarCases(HSLScalar, {
		accepted: [
			'hsl(120, 100%, 50%)',
			'hsl(0, 0%, 0%)',
			'hsl(359, 100%, 100%)',
			'hsl(7, 5%, 99%)',
		],
		refused: [
			'hsl(360, 100%, 50%)',
			'hsl(120, 101%, 50%)',
			'hsl(120, 100, 50)',
			'hsl(120deg, 100%, 50%)',
			'hsl(-1, 0%, 0%)',
			'hsl(120,100%,50%)',
			'hsl(120 100% 50%)',
			'hsl(120, 100%, 50%, 0.5)',
			'hsl(120, 050%, 50%)',
			'hsl(120.5, 100%, 50%)',
			'',
		],
	});
});
