import { negativeIntSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { negativeIntSchema };

export const NegativeIntScalar = zodScalar(negativeIntSchema, {
	name: 'NegativeInt',
	description: 'An integer from -2147483648 to -1.',
	literals: 'integer',
});
