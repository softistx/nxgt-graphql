import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A calendar date, `YYYY-MM-DD`, kept a string on both sides: a `Date` is
 * an instant, and turning a birthday into one shifts it by a day in half
 * the time zones. An impossible day (`2021-02-30`) is refused.
 */
export const dateSchema = z.iso.date();

export const DateScalar = zodScalar(dateSchema, {
	name: 'Date',
	description: 'A calendar date, YYYY-MM-DD, with no time and no time zone.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339',
});
