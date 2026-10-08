import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A cuid2: a lowercase letter, then lowercase letters and digits, 2 to 32
 * characters in all (24 by default). Zod's `z.cuid2()` alone takes any run
 * of lowercase letters and digits, `1abc` included.
 */
export const cuid2Schema = z.cuid2().regex(/^[a-z][0-9a-z]{1,31}$/, {
	error: 'Invalid cuid2',
});

export const Cuid2Scalar = zodScalar(cuid2Schema, {
	name: 'Cuid2',
	description:
		'A cuid2: a lowercase letter, then lowercase letters and digits, 2 to 32 in all.',
	specifiedByURL: 'https://github.com/paralleldrive/cuid2',
});
