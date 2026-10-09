import { hslSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { hslSchema };

export const HSLScalar = zodScalar(hslSchema, {
	name: 'HSL',
	description: 'A CSS hsl() color, such as hsl(120, 100%, 50%).',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#the-hsl-notation',
});
