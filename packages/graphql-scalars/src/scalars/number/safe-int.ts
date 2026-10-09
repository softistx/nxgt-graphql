import { safeIntSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { safeIntSchema };

export const SafeIntScalar = zodScalar(safeIntSchema, {
	name: 'SafeInt',
	description: 'An integer from -9007199254740991 to 9007199254740991.',
	literals: 'integer',
});
