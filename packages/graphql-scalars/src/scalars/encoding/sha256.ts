import { sha256Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { sha256Schema };

export const SHA256Scalar = zodScalar(sha256Schema, {
	name: 'SHA256',
	description: 'A SHA-256 digest: 64 hexadecimal digits.',
	specifiedByURL: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final',
});
