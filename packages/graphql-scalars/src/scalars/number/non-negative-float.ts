import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** A finite number, 0 or above. */
export const nonNegativeFloatSchema = z.number().nonnegative();

export const NonNegativeFloatScalar = zodScalar(nonNegativeFloatSchema, {
	name: 'NonNegativeFloat',
	description: 'A finite number, 0 or above.',
});
