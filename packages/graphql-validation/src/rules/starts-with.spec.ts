import { ruleCases } from '../../test/rule-cases';
import { startsWithRule } from './starts-with';

ruleCases(startsWithRule, 'nx-', {
	accepts: ['nx-1', 'nx-'],
	rejects: ['x-nx-', 'NX-1'],
});

// toCode must write a string that evaluates back to the same value.
// biome-ignore lint/suspicious/noTemplateCurlyInString: a literal ${ is the case
const nasty = 'a\\b\n"${x}\u2028';
ruleCases(startsWithRule, nasty, {
	accepts: [`${nasty}!`],
	rejects: [`!${nasty}`],
});
