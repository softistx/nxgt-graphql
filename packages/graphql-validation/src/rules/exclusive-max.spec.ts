import { ruleCases } from '../../test/rule-cases';
import { exclusiveMaxRule } from './exclusive-max';

ruleCases(exclusiveMaxRule, 1, { accepts: [0.99], rejects: [1, 2] });
