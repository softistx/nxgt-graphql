import { z } from 'zod';
import { noNegativeZero } from '../../rules/integer';
import { zodScalar } from '../../zod-scalar';

/** A TCP or UDP port number, 0 to 65535. */
export const portSchema = noNegativeZero(z.int().min(0).max(65535));

export const PortScalar = zodScalar(portSchema, {
	name: 'Port',
	description: 'A TCP or UDP port number, from 0 to 65535.',
	literals: 'integer',
});
