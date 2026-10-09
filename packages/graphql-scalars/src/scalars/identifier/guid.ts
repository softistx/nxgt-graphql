import { guidSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { guidSchema };

export const GUIDScalar = zodScalar(guidSchema, {
	name: 'GUID',
	description: 'A GUID: 8-4-4-4-12 hexadecimal digits, with no version check.',
});
