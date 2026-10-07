import { ruleCases } from '../../test/rule-cases';
import { minItemsRule } from './min-items';

ruleCases(minItemsRule, 1, { accepts: [['a'], ['a', 'b']], rejects: [[]] });
