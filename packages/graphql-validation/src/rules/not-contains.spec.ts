import { ruleCases } from '../../test/rule-cases';
import { notContainsRule } from './not-contains';

ruleCases(notContainsRule, '"', { accepts: ['plain'], rejects: ['say "hi"'] });

// toCode must write a string that evaluates back to the same value.
// biome-ignore lint/suspicious/noTemplateCurlyInString: a literal ${ is the case
const nasty = 'a\\b\n"${x}\u2028';
ruleCases(notContainsRule, nasty, {
	accepts: ['plain'],
	rejects: [`x${nasty}`],
});
