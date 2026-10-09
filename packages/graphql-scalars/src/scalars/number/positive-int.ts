import { positiveIntSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { positiveIntSchema };

export const PositiveIntScalar = zodScalar(positiveIntSchema, {
	name: 'PositiveInt',
	description: 'An integer from 1 to 2147483647.',
	literals: 'integer',
});
