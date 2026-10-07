import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A SHA-256 digest as 64 hexadecimal digits, in either case, kept as sent.
 */
export const sha256Schema = z.hash('sha256', {
	error: 'Invalid SHA-256 digest: expected 64 hexadecimal digits',
});

export const SHA256Scalar = zodScalar(sha256Schema, {
	name: 'SHA256',
	description: 'A SHA-256 digest: 64 hexadecimal digits.',
	specifiedByURL: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final',
});
