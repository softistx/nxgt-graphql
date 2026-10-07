import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A KSUID: 27 characters of base62, at most `aWgEPTl1tmebfsQzFP4bxwgy80V`
 * (160 bits). The alphabet is in ASCII order and the length fixed, so
 * comparing the strings compares the numbers.
 */
export const ksuidSchema = z
	.ksuid()
	.refine((id) => id <= 'aWgEPTl1tmebfsQzFP4bxwgy80V', {
		error: 'Invalid KSUID',
	});

export const KSUIDScalar = zodScalar(ksuidSchema, {
	name: 'KSUID',
	description: 'A KSUID: 27 characters of base62.',
	specifiedByURL: 'https://github.com/segmentio/ksuid',
});
