import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** A finite number above 0. */
export const positiveFloatSchema = z.number().positive();

export const PositiveFloatScalar = zodScalar(positiveFloatSchema, {
	name: 'PositiveFloat',
	description: 'A finite number above 0.',
});
