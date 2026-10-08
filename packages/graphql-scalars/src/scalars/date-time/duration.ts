import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An ISO 8601 duration: `P` then years, months, weeks, days, and after `T`
 * hours, minutes, seconds (`P1Y2M3DT4H5M6S`, `PT0.5S`, `P2W`). Weeks are not
 * mixed with other units, there is no sign, and the letters are uppercase.
 * Only seconds take a fraction, with a dot or ISO's comma (`PT0,5S`), kept
 * as sent.
 */
export const durationSchema = z.iso.duration();

export const DurationScalar = zodScalar(durationSchema, {
	name: 'Duration',
	description: 'An ISO 8601 duration, such as P1DT2H or PT0.5S.',
	specifiedByURL: 'https://www.iso.org/iso-8601-date-and-time-format.html',
});
