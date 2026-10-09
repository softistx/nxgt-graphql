import { voidSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { voidSchema };

export const VoidScalar = zodScalar(voidSchema, {
	name: 'Void',
	description: 'No value: always null.',
});
