import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An RFC 3339 `full-time`: a time of day with its offset, `HH:MM:SS`, an
 * optional fraction, then `Z` or `±HH:MM` (`10:15:30Z`, `10:15:30.5+02:00`).
 * The offset is canonical: an uppercase `Z`, hours 00 to 23, and no
 * `-00:00` (write `+00:00`, as `UtcOffset` does). No leap second.
 */
export const timeSchema = z
	.string()
	.regex(
		/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/,
		{ error: 'Invalid time: expected HH:MM:SS with an offset' },
	)
	.refine((text) => !text.endsWith('-00:00'), {
		error: 'Invalid time: write no offset as +00:00',
	});

export const TimeScalar = zodScalar(timeSchema, {
	name: 'Time',
	description:
		'A time of day with its offset, such as 10:15:30Z (RFC 3339 full-time).',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339#section-5.6',
});
