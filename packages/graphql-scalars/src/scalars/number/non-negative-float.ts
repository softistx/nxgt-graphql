import { nonNegativeFloatSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { nonNegativeFloatSchema };

export const NonNegativeFloatScalar = zodScalar(nonNegativeFloatSchema, {
	name: 'NonNegativeFloat',
	description: 'A finite number, 0 or above.',
});
