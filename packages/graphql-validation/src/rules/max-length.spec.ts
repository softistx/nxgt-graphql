import { ruleCases } from '../../test/rule-cases';
import { maxLengthRule } from './max-length';

ruleCases(maxLengthRule, 3, { accepts: ['', 'abc'], rejects: ['abcd'] });
