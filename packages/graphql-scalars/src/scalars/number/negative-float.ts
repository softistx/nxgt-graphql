import { negativeFloatSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { negativeFloatSchema };

export const NegativeFloatScalar = zodScalar(negativeFloatSchema, {
	name: 'NegativeFloat',
	description: 'A finite number below 0.',
});
