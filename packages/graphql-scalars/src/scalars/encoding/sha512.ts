import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A SHA-512 digest as 128 hexadecimal digits, in either case, kept as sent.
 */
export const sha512Schema = z.hash('sha512', {
	error: 'Invalid SHA-512 digest: expected 128 hexadecimal digits',
});

export const SHA512Scalar = zodScalar(sha512Schema, {
	name: 'SHA512',
	description: 'A SHA-512 digest: 128 hexadecimal digits.',
	specifiedByURL: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final',
});
