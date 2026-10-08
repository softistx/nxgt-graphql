import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A time of day with no offset: `HH:MM`, or `HH:MM:SS` with an optional
 * fraction (`10:15`, `10:15:30.5`). It names no instant until a date and a
 * place are given.
 */
export const localTimeSchema = z.iso.time();

export const LocalTimeScalar = zodScalar(localTimeSchema, {
	name: 'LocalTime',
	description: 'A time of day with no offset, such as 10:15 or 10:15:30.',
});
