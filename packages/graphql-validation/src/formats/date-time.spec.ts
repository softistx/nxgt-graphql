import { formatCases } from '../../test/rule-cases';
import { dateTimeFormat } from './date-time';

formatCases(dateTimeFormat, {
	accepts: ['2026-10-07T12:00:00Z', '2026-10-07T12:00:00.123+02:00'],
	rejects: ['2026-10-07', '2026-10-07 12:00:00'],
});
