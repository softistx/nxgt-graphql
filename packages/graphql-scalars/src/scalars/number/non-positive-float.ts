import { nonPositiveFloatSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { nonPositiveFloatSchema };

export const NonPositiveFloatScalar = zodScalar(nonPositiveFloatSchema, {
	name: 'NonPositiveFloat',
	description: 'A finite number, 0 or below.',
});
