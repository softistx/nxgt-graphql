import type { z } from 'zod';

/**
 * The source of an RFC 3339 `time-offset`, in its canonical spelling: an
 * uppercase `Z`, or `±HH:MM` with hours 00 to 23. Pair it with
 * {@link noNegativeZeroOffset}.
 */
export const OFFSET = '(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)';

/**
 * Refuses a text ending in `-00:00`. RFC 3339 gives it a meaning of its own
 * (the offset is unknown), and no offset is written `+00:00` or `Z`, so it
 * is never a second spelling taken as the first. `Time`, `UtcOffset` and
 * `DateTime` share it.
 */
export function noNegativeZeroOffset<S extends z.ZodType<string, string>>(
	schema: S,
) {
	return schema.refine((text) => !text.endsWith('-00:00'), {
		error: 'Invalid offset: write no offset as +00:00',
	});
}
