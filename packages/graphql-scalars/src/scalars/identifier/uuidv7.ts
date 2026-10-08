import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An RFC 9562 UUID of version 7 (time-ordered).
 */
export const uuidv7Schema = z.uuidv7();

export const UUIDv7Scalar = zodScalar(uuidv7Schema, {
	name: 'UUIDv7',
	description: 'A version 7 (time-ordered) UUID.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});
