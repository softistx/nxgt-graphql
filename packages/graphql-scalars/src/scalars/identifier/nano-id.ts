import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A Nano ID of the default shape: 21 characters of `A-Za-z0-9_-`.
 */
export const nanoIdSchema = z.nanoid();

export const NanoIDScalar = zodScalar(nanoIdSchema, {
	name: 'NanoID',
	description: 'A Nano ID: 21 characters of A-Z, a-z, 0-9, _ and -.',
	specifiedByURL: 'https://github.com/ai/nanoid',
});
