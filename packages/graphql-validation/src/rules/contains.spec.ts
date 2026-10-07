import { ruleCases } from '../../test/rule-cases';
import { containsRule } from './contains';

ruleCases(containsRule, '@', { accepts: ['a@b', '@'], rejects: ['ab'] });
