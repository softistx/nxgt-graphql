import { z } from 'zod';
import { validDate } from '../../rules/date';
import { noNegativeZero } from '../../rules/integer';
import { zodScalar } from '../../zod-scalar';

/** The furthest a `Date` reaches either side of 1970, in milliseconds. */
const LIMIT = 8.64e15;

/**
 * An instant as milliseconds since 1970-01-01T00:00:00Z on the wire (an
 * integer, negative before 1970), a `Date` in the resolvers. Past 2³¹, so
 * not GraphQL's `Int`. An invalid `Date` is refused on the way out.
 */
export const timestampSchema = z.codec(
	noNegativeZero(z.int().min(-LIMIT).max(LIMIT)),
	validDate(),
	{
		decode: (milliseconds) => new Date(milliseconds),
		encode: (date) => date.getTime(),
	},
);

export const TimestampScalar = zodScalar(timestampSchema, {
	name: 'Timestamp',
	description:
		'An instant, as an integer number of milliseconds since 1970-01-01T00:00:00Z.',
	literals: 'integer',
});
