import { ruleCases } from '../../test/rule-cases';
import { endsWithRule } from './ends-with';

ruleCases(endsWithRule, '.pdf', {
	accepts: ['a.pdf'],
	rejects: ['a.pdf.zip', 'a.PDF'],
});

// toCode must write a string that evaluates back to the same value.
// biome-ignore lint/suspicious/noTemplateCurlyInString: a literal ${ is the case
const nasty = 'a\\b\n"${x}\u2028';
ruleCases(endsWithRule, nasty, {
	accepts: [`!${nasty}`],
	rejects: [`${nasty}!`],
});
