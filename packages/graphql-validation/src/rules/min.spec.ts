import { ruleCases } from '../../test/rule-cases';
import { minRule } from './min';

ruleCases(minRule, 18, { accepts: [18, 99.5], rejects: [17.9, '18'] });

// toCode must write a number that evaluates back to the same value.
ruleCases(minRule, -0.5, { accepts: [-0.5, 0], rejects: [-0.6] });
ruleCases(minRule, 1e21, { accepts: [1e21], rejects: [1e20] });
ruleCases(minRule, 1e-7, { accepts: [1e-7], rejects: [1e-8] });
