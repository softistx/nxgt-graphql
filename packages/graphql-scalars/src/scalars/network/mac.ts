import { macSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { macSchema };

export const MACScalar = zodScalar(macSchema, {
	name: 'MAC',
	description:
		'A MAC address: six hex pairs separated by colons (not the IEEE hyphen form).',
});
