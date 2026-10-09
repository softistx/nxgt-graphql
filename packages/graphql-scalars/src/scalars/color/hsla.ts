import { hslaSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { hslaSchema };

export const HSLAScalar = zodScalar(hslaSchema, {
	name: 'HSLA',
	description: 'A CSS hsla() color, such as hsla(120, 100%, 50%, 0.5).',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#the-hsl-notation',
});
