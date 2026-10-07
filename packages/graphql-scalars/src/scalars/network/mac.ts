import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A 48-bit MAC address, six hex pairs separated by `:`, all lowercase or all
 * uppercase (`00:1a:2b:3c:4d:5e`).
 */
export const macSchema = z.mac();

export const MACScalar = zodScalar(macSchema, {
	name: 'MAC',
	description:
		'A MAC address: six hex pairs separated by colons (not the IEEE hyphen form).',
});
