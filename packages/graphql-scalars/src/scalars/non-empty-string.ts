import { z } from 'zod';
import { zodScalar } from '../zod-scalar';

/** A string with at least one character that is not white space. */
export const nonEmptyString = z
	.string()
	.regex(/\S/, 'Must not be empty or blank');

export const NonEmptyStringScalar = zodScalar(nonEmptyString, {
	name: 'NonEmptyString',
	description: 'A string that is not empty and not only white space.',
});
