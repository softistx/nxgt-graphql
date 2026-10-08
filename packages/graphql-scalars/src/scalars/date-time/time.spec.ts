import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { TimeScalar } from './time';

describe('Time', () => {
	scalarCases(TimeScalar, {
		accepted: [
			'10:15:30Z',
			'00:00:00Z',
			'23:59:59.999+14:00',
			'10:15:30-05:00',
			'10:15:30.5+02:00',
		],
		refused: [
			'10:15:30-00:00',
			'10:15:30',
			'10:15Z',
			'24:00:00Z',
			'23:59:60Z',
			'10:15:30z',
			'10:15:30+2:00',
			'10:15:30+0200',
			'10:15:30.Z',
			' 10:15:30Z',
			'',
		],
	});
});
