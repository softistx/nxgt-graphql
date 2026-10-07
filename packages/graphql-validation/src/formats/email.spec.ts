import { formatCases } from '../../test/rule-cases';
import { emailFormat } from './email';

formatCases(emailFormat, {
	accepts: ['ada@example.com'],
	rejects: ['ada', 'ada@', '@example.com'],
});
