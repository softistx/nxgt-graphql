import { formatCases } from '../../test/rule-cases';
import { uuidFormat } from './uuid';

formatCases(uuidFormat, {
	accepts: ['123e4567-e89b-42d3-a456-426614174000'],
	rejects: ['123e4567', 'not-a-uuid'],
});
