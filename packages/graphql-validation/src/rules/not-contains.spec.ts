import { ruleCases } from '../../test/rule-cases';
import { notContainsRule } from './not-contains';

ruleCases(notContainsRule, '"', { accepts: ['plain'], rejects: ['say "hi"'] });
