import { longSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { longSchema };

export const LongScalar = zodScalar(longSchema, {
	name: 'Long',
	description:
		'A signed 64-bit integer, as a decimal string (a safe-integer number is accepted as input).',
	literals: 'integer',
});
