import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A ULID: 26 characters of Crockford base32, the first 0 to 7. Crockford
 * base32 ignores case, so either case is taken, and kept as sent.
 */
export const ulidSchema = z.ulid();

export const ULIDScalar = zodScalar(ulidSchema, {
	name: 'ULID',
	description: 'A ULID: 26 characters of Crockford base32.',
	specifiedByURL: 'https://github.com/ulid/spec',
});
