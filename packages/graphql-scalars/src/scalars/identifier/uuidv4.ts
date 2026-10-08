import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An RFC 9562 UUID of version 4 (random).
 */
export const uuidv4Schema = z.uuidv4();

export const UUIDv4Scalar = zodScalar(uuidv4Schema, {
	name: 'UUIDv4',
	description: 'A version 4 (random) UUID.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});
