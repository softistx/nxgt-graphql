import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A non-empty run of hexadecimal digits, in any case, kept as sent. No `0x`
 * prefix.
 */
export const hexadecimalSchema = z
	.hex()
	.min(1, { error: 'Expected at least one hexadecimal digit' });

export const HexadecimalScalar = zodScalar(hexadecimalSchema, {
	name: 'Hexadecimal',
	description: 'A non-empty string of hexadecimal digits.',
});
