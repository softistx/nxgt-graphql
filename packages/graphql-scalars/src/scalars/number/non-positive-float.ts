import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** A finite number, 0 or below. */
export const nonPositiveFloatSchema = z.number().nonpositive();

export const NonPositiveFloatScalar = zodScalar(nonPositiveFloatSchema, {
	name: 'NonPositiveFloat',
	description: 'A finite number, 0 or below.',
});
