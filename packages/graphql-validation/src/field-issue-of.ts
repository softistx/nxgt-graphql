import type { z } from 'zod';
import { type FieldIssue, inputPath } from './invalid-input';

/**
 * The codes `fieldIssueOf` gives, each under `validation.errors.`: a string's
 * length (`too-short`, `too-long`), a number's or bigint's bound or multiple
 * (`out-of-range`), a list's or set's size (`too-few`, `too-many`), a named
 * format or a pattern (`invalid-format`), anything else (`invalid`).
 */
export const FIELD_CODES = {
	tooShort: 'validation.errors.too-short',
	tooLong: 'validation.errors.too-long',
	outOfRange: 'validation.errors.out-of-range',
	tooFew: 'validation.errors.too-few',
	tooMany: 'validation.errors.too-many',
	invalidFormat: 'validation.errors.invalid-format',
	invalid: 'validation.errors.invalid',
} as const;

/** The string checks Zod reports as `invalid_format` that are not a format. */
const TEXT_CHECKS: ReadonlySet<string> = new Set([
	'starts_with',
	'ends_with',
	'includes',
]);

/**
 * A Zod issue as a `FieldIssue`, for `invalidInputError`: its path through
 * `inputPath` (dotted, a leading `input` dropped) and one of `FIELD_CODES`,
 * without params. `too-short` / `too-long` for a string's length,
 * `out-of-range` for a number's or bigint's bound or a multiple, `too-few` /
 * `too-many` for a list's or set's size, `invalid-format` for a named format
 * or a pattern, `invalid` for anything else (a prefix, a suffix or a
 * substring included).
 */
export function fieldIssueOf(issue: z.core.$ZodIssue): FieldIssue {
	return { path: inputPath(issue.path), code: codeOf(issue) };
}

function codeOf(issue: z.core.$ZodIssue): string {
	switch (issue.code) {
		case 'too_small':
		case 'too_big': {
			const small = issue.code === 'too_small';
			switch (issue.origin) {
				case 'string':
					return small ? FIELD_CODES.tooShort : FIELD_CODES.tooLong;
				case 'number':
				case 'bigint':
					return FIELD_CODES.outOfRange;
				case 'array':
				case 'set':
					return small ? FIELD_CODES.tooFew : FIELD_CODES.tooMany;
				default:
					return FIELD_CODES.invalid;
			}
		}
		case 'not_multiple_of':
			return FIELD_CODES.outOfRange;
		case 'invalid_format':
			// A prefix, a suffix or a substring is not a format: only a named
			// format (`email`, `uuid`, …) or a pattern is.
			return TEXT_CHECKS.has(issue.format)
				? FIELD_CODES.invalid
				: FIELD_CODES.invalidFormat;
		default:
			return FIELD_CODES.invalid;
	}
}
