import { nonNegativeIntSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { nonNegativeIntSchema };

export const NonNegativeIntScalar = zodScalar(nonNegativeIntSchema, {
	name: 'NonNegativeInt',
	description: 'An integer from 0 to 2147483647.',
	literals: 'integer',
});
