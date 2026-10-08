import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { HexColorCodeScalar } from './hex-color-code';

describe('HexColorCode', () => {
	scalarCases(HexColorCodeScalar, {
		accepted: [
			'#f00',
			'#F00',
			'#f008',
			'#ff0000',
			'#FF0000',
			'#ff000080',
			'#aBcDeF',
		],
		refused: [
			'#f00\n',
			'f00',
			'#ff',
			'#fffff',
			'#fffffff',
			'#fffffffff',
			'#ggg',
			'# f00',
			'#ff0000 ',
			'',
			0xff0000,
		],
	});
});
