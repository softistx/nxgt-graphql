import { ruleCases } from '../../test/rule-cases';
import { exclusiveMaxRule } from './exclusive-max';

ruleCases(exclusiveMaxRule, 1, { accepts: [0.99], rejects: [1, 2] });

// toCode must write a number that evaluates back to the same value.
ruleCases(exclusiveMaxRule, -0.5, { accepts: [-0.6], rejects: [-0.5] });
ruleCases(exclusiveMaxRule, 1e21, { accepts: [1e20], rejects: [1e21] });
ruleCases(exclusiveMaxRule, 1e-7, { accepts: [1e-8], rejects: [1e-7] });
