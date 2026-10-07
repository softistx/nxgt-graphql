import { ruleCases } from '../../test/rule-cases';
import { maxItemsRule } from './max-items';

ruleCases(maxItemsRule, 2, {
	accepts: [[], ['a', 'b']],
	rejects: [['a', 'b', 'c']],
});
