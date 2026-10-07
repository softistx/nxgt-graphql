import { ruleCases } from '../../test/rule-cases';
import { maxRule } from './max';

ruleCases(maxRule, 10, { accepts: [10, -1], rejects: [10.1] });
