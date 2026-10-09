import { hexadecimalSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { hexadecimalSchema };

export const HexadecimalScalar = zodScalar(hexadecimalSchema, {
	name: 'Hexadecimal',
	description: 'A non-empty string of hexadecimal digits.',
});
