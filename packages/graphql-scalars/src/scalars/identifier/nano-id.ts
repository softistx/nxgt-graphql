import { nanoIdSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { nanoIdSchema };

export const NanoIDScalar = zodScalar(nanoIdSchema, {
	name: 'NanoID',
	description: 'A Nano ID: 21 characters of A-Z, a-z, 0-9, _ and -.',
	specifiedByURL: 'https://github.com/ai/nanoid',
});
