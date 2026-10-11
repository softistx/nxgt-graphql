// The translator the `translate` option names: a code and its params to a
// sentence, the code itself for one it does not know.
import type { Translate } from '@nxgt/graphql-validation';

const messages: Record<
	string,
	(params: Record<string, string | number>) => string
> = {
	'validation.errors.invalid-input': () => 'Some fields are invalid',
	'validation.errors.too_small': ({ min }) => `At least ${min}`,
	'validation.errors.invalid_format': ({ format }) => `Not a valid ${format}`,
};

export const translate: Translate = (code, params = {}) =>
	messages[code]?.(params) ?? code;
