import { ruleCases } from '../../test/rule-cases';
import { exclusiveMinRule } from './exclusive-min';

ruleCases(exclusiveMinRule, 0, { accepts: [0.1], rejects: [0, -1] });
