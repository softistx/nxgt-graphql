import { nonPositiveIntSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { nonPositiveIntSchema };

export const NonPositiveIntScalar = zodScalar(nonPositiveIntSchema, {
	name: 'NonPositiveInt',
	description: 'An integer from -2147483648 to 0.',
	literals: 'integer',
});
