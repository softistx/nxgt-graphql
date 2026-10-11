// A formatSchemas record, as an application hands withValidation its own
// formats: one name a plain key, one hyphenated, and one whose check aborts,
// so the rules chained after it never run.
import { z } from 'zod';

export const formatSchemas = {
	slug: z
		.string()
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'Invalid slug: lowercase words joined by hyphens',
		),
	'country-code': z
		.string()
		.length(2)
		.refine(
			(value) => value === value.toUpperCase(),
			'Invalid country code: write it uppercase',
		),
	code: z.string().refine((value) => /^[A-Z]+$/.test(value), {
		message: 'Invalid code: uppercase letters only',
		abort: true,
	}),
};
