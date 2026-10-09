import { sha512Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { sha512Schema };

export const SHA512Scalar = zodScalar(sha512Schema, {
	name: 'SHA512',
	description: 'A SHA-512 digest: 128 hexadecimal digits.',
	specifiedByURL: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final',
});
