import { uuidv4Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { uuidv4Schema };

export const UUIDv4Scalar = zodScalar(uuidv4Schema, {
	name: 'UUIDv4',
	description: 'A version 4 (random) UUID.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});
