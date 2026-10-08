import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { HSLAScalar } from './hsla';

describe('HSLA', () => {
	scalarCases(HSLAScalar, {
		accepted: [
			'hsla(120, 100%, 50%, 0.5)',
			'hsla(0, 0%, 0%, 0)',
			'hsla(359, 100%, 100%, 1)',
		],
		refused: [
			'hsla(120, 100%, 50%, 0.5)\n',
			'hsla(120, 100%, 50%, 2)',
			'hsla(120, 100%, 50%, 1.0)',
			'hsla(120, 100%, 50%, .5)',
			'hsla(360, 100%, 50%, 0.5)',
			'hsla(120, 100%, 50%)',
			'hsl(120, 100%, 50%, 0.5)',
			'hsla(120,100%,50%,0.5)',
			'',
		],
	});
});
