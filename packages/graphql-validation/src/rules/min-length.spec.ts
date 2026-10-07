import { ruleCases } from '../../test/rule-cases';
import { minLengthRule } from './min-length';

ruleCases(minLengthRule, 2, { accepts: ['ab', 'abc'], rejects: ['a', '', 3] });
