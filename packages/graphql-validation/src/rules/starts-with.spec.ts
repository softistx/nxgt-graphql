import { ruleCases } from '../../test/rule-cases';
import { startsWithRule } from './starts-with';

ruleCases(startsWithRule, 'nx-', {
	accepts: ['nx-1', 'nx-'],
	rejects: ['x-nx-', 'NX-1'],
});
