import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { LocalTimeScalar } from './local-time';

describe('LocalTime', () => {
	scalarCases(LocalTimeScalar, {
		accepted: ['10:15', '10:15:30', '00:00', '23:59:59.999'],
		refused: [
			'24:00',
			'10:15:30Z',
			'10:15:30+02:00',
			'1:15',
			'10:15:60',
			'10:15:30.',
			'',
		],
	});
});
