import { ulidSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { ulidSchema };

export const ULIDScalar = zodScalar(ulidSchema, {
	name: 'ULID',
	description: 'A ULID: 26 characters of Crockford base32.',
	specifiedByURL: 'https://github.com/ulid/spec',
});
