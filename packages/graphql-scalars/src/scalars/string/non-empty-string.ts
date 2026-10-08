import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A string with at least one character that is not white space, kept as
 * sent (not trimmed). White space is JavaScript's `\s`: Unicode's spaces
 * and line breaks, U+00A0 and U+FEFF among them, but not U+200B (zero
 * width space), which is a format character.
 */
export const nonEmptyStringSchema = z
	.string()
	.regex(/\S/, { error: 'Invalid string: empty or only white space' });

export const NonEmptyStringScalar = zodScalar(nonEmptyStringSchema, {
	name: 'NonEmptyString',
	description: 'A string that is not empty and not only white space.',
});
