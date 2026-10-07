import { formatCases } from '../../test/rule-cases';
import { byteFormat } from './byte';

formatCases(byteFormat, {
	accepts: ['aGVsbG8=', ''],
	rejects: ['not base64!', 'aGVsbG8'],
});
