import { uuidv7Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { uuidv7Schema };

export const UUIDv7Scalar = zodScalar(uuidv7Schema, {
	name: 'UUIDv7',
	description: 'A version 7 (time-ordered) UUID.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});
