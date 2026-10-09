import { bigIntSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { bigIntSchema };

export const BigIntScalar = zodScalar(bigIntSchema, {
	name: 'BigInt',
	description:
		'An integer of any size, as a decimal string (a safe-integer number is accepted as input).',
	literals: 'integer',
});
