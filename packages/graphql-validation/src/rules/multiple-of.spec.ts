import { ruleCases } from '../../test/rule-cases';
import { multipleOfRule } from './multiple-of';

ruleCases(multipleOfRule, 0.5, { accepts: [1, 1.5, 0], rejects: [1.2] });
