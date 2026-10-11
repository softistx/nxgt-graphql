// The translator the `translate` option names: a code to a sentence, the
// code itself for one it does not know.
import type { Translate } from '@nxgt/graphql-validation';

const messages: Record<string, string> = {
	'validation.errors.invalid-input': 'Some fields are invalid',
	'validation.errors.too-short': 'Too short',
	'validation.errors.invalid-format': 'Not valid',
};

export const translate: Translate = (code) => messages[code] ?? code;
