import { ruleCases } from '../../test/rule-cases';
import { patternRule } from './pattern';

ruleCases(patternRule, '^[a-z]+\\d?$', {
	accepts: ['abc', 'abc1'],
	rejects: ['ABC', 'abc12', ''],
});
