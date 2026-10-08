import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { UtcOffsetScalar } from './utc-offset';

describe('UtcOffset', () => {
	scalarCases(UtcOffsetScalar, {
		accepted: ['+00:00', '+05:30', '-08:00', '+14:00', '-12:00', '+13:45'],
		refused: [
			'-00:00',
			'+14:30',
			'-12:30',
			'+15:00',
			'05:30',
			'+5:30',
			'+0530',
			'Z',
			'UTC',
			'',
		],
	});
});
