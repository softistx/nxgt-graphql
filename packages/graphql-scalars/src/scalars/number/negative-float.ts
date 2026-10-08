import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** A finite number below 0. */
export const negativeFloatSchema = z.number().negative();

export const NegativeFloatScalar = zodScalar(negativeFloatSchema, {
	name: 'NegativeFloat',
	description: 'A finite number below 0.',
});
