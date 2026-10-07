import { ruleCases } from '../../test/rule-cases';
import { exclusiveMinRule } from './exclusive-min';

ruleCases(exclusiveMinRule, 0, { accepts: [0.1], rejects: [0, -1] });

// toCode must write a number that evaluates back to the same value.
ruleCases(exclusiveMinRule, -0.5, { accepts: [-0.4], rejects: [-0.5] });
ruleCases(exclusiveMinRule, 1e21, { accepts: [2e21], rejects: [1e21] });
ruleCases(exclusiveMinRule, 1e-7, { accepts: [1e-6], rejects: [1e-7] });
