import { ruleCases } from '../../test/rule-cases';
import { endsWithRule } from './ends-with';

ruleCases(endsWithRule, '.pdf', {
	accepts: ['a.pdf'],
	rejects: ['a.pdf.zip', 'a.PDF'],
});
