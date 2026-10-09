import { positiveFloatSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { positiveFloatSchema };

export const PositiveFloatScalar = zodScalar(positiveFloatSchema, {
	name: 'PositiveFloat',
	description: 'A finite number above 0.',
});
