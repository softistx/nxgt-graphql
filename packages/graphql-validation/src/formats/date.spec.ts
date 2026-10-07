import { formatCases } from '../../test/rule-cases';
import { dateFormat } from './date';

formatCases(dateFormat, {
	accepts: ['2026-10-07', '2024-02-29'],
	rejects: ['2026-13-01', '2026-10-07T00:00:00Z'],
});
