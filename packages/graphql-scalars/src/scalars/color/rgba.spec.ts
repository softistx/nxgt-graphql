import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { RGBAScalar } from './rgba';

describe('RGBA', () => {
	scalarCases(RGBAScalar, {
		accepted: [
			'rgba(255, 0, 0, 0.5)',
			'rgba(0, 0, 0, 0)',
			'rgba(0, 0, 0, 1)',
			'rgba(1, 2, 3, 0.125)',
		],
		refused: [
			'rgba(255, 0, 0, 1.5)',
			'rgba(255, 0, 0, 1.0)',
			'rgba(255, 0, 0, 0.50)',
			'rgba(255, 0, 0, .5)',
			'rgba(255, 0, 0, 50%)',
			'rgba(255, 0, 0)',
			'rgba(256, 0, 0, 0.5)',
			'rgba(255,0,0,0.5)',
			'rgb(255, 0, 0, 0.5)',
			'',
		],
	});
});
