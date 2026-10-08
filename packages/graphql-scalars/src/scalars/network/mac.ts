import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A 48-bit MAC address, six hex pairs separated by `:` (`00:1a:2b:3c:4d:5e`),
 * in any case, kept as sent. `:` is Zod's only separator by default; the
 * IEEE hyphen form and Cisco's dotted form are refused. Zod's own pattern
 * takes one case per address, this one any; the format stays `mac`, so the
 * message is Zod's.
 */
export const macSchema = z.stringFormat(
	'mac',
	/^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
);

export const MACScalar = zodScalar(macSchema, {
	name: 'MAC',
	description:
		'A MAC address: six hex pairs separated by colons (not the IEEE hyphen form).',
});
