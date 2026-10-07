import { ruleCases } from '../../test/rule-cases';
import { maxRule } from './max';

ruleCases(maxRule, 10, { accepts: [10, -1], rejects: [10.1] });

// toCode must write a number that evaluates back to the same value.
ruleCases(maxRule, -0.5, { accepts: [-0.5, -1], rejects: [-0.4] });
ruleCases(maxRule, 1e21, { accepts: [1e21], rejects: [2e21] });
ruleCases(maxRule, 1e-7, { accepts: [1e-7], rejects: [1e-6] });
