import { z } from 'zod';
import { zodScalar } from '../zod-scalar';

/**
 * An RFC 3339 date-time with its offset (`Z` or `±hh:mm`) on the wire, a
 * `Date` in the resolvers. A time with no offset is refused: it names no
 * instant. The way out writes `toISOString()`, so always in UTC.
 */
export const dateTime = z.codec(
	z.iso.datetime({ offset: true }),
	// Zod's own message for `new Date(NaN)` is "expected date, received Date".
	z.date({
		error: (issue) =>
			issue.input instanceof Date ? 'Invalid Date' : undefined,
	}),
	{
		decode: (text) => new Date(text),
		encode: (date) => date.toISOString(),
	},
);

export const DateTimeScalar = zodScalar(dateTime, {
	name: 'DateTime',
	description: 'An instant: an RFC 3339 date-time with its offset.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339',
});
