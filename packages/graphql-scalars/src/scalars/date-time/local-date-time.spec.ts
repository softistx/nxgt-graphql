import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { LocalDateTimeScalar } from './local-date-time';

describe('LocalDateTime', () => {
	scalarCases(LocalDateTimeScalar, {
		accepted: [
			'2024-03-10T10:15:30',
			'2024-03-10T10:15',
			'2024-02-29T00:00:00.5',
		],
		refused: [
			'2024-03-10T10:15:30Z',
			'2024-03-10T10:15:30+02:00',
			'2024-03-10 10:15:30',
			'2024-02-30T10:15:30',
			'2023-02-29T10:15',
			'2024-03-10',
			'',
		],
	});
});
