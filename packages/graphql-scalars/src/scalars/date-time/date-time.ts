import { z } from 'zod';
import { validDate } from '../../rules/date';
import { noNegativeZeroOffset } from '../../rules/offset';
import { zodScalar } from '../../zod-scalar';

/**
 * The instants the wire can write back: `toISOString()` writes a year past
 * 9999 or before 0000 with six digits and a sign, which is not RFC 3339.
 */
const EARLIEST = new Date('0000-01-01T00:00:00.000Z');
const LATEST = new Date('9999-12-31T23:59:59.999Z');
const RANGE = 'Invalid DateTime: outside 0000-01-01 to 9999-12-31 in UTC';

/**
 * The text with its fraction of a second exactly three digits, padded or
 * cut: the one form `new Date` must read the same in every engine (a longer
 * or shorter one is left to each engine's own parser).
 */
function withMilliseconds(text: string): string {
	return text.replace(
		/(T\d\d:\d\d:\d\d)(?:\.(\d+))?/,
		(_, time: string, fraction = '') =>
			`${time}.${fraction.padEnd(3, '0').slice(0, 3)}`,
	);
}

/**
 * An RFC 3339 date-time with its offset (`Z` or `±hh:mm`) on the wire, a
 * `Date` in the resolvers. A time with no offset is refused: it names no
 * instant; so is `-00:00`, which RFC 3339 keeps for an unknown offset. A
 * fraction past milliseconds is cut, not rounded. Both ways the instant is
 * from 0000-01-01 to 9999-12-31 in UTC, what `toISOString()` writes as
 * RFC 3339; the way out writes it, so always in UTC.
 */
export const dateTimeSchema = z.codec(
	noNegativeZeroOffset(z.iso.datetime({ offset: true })),
	validDate().min(EARLIEST, { error: RANGE }).max(LATEST, { error: RANGE }),
	{
		decode: (text) => new Date(withMilliseconds(text)),
		encode: (date) => date.toISOString(),
	},
);

export const DateTimeScalar = zodScalar(dateTimeSchema, {
	name: 'DateTime',
	description: 'An instant: an RFC 3339 date-time with its offset.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339',
});
