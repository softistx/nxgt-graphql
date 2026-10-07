import { ruleCases } from '../../test/rule-cases';
import { minRule } from './min';

ruleCases(minRule, 18, { accepts: [18, 99.5], rejects: [17.9, '18'] });
