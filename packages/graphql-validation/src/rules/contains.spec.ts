import { ruleCases } from '../../test/rule-cases';
import { containsRule } from './contains';

ruleCases(containsRule, '@', { accepts: ['a@b', '@'], rejects: ['ab'] });

// toCode must write a string that evaluates back to the same value.
// biome-ignore lint/suspicious/noTemplateCurlyInString: a literal ${ is the case
const nasty = 'a\\b\n"${x}\u2028';
ruleCases(containsRule, nasty, { accepts: [`x${nasty}y`], rejects: ['a\b'] });
