import { rgbaSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { rgbaSchema };

export const RGBAScalar = zodScalar(rgbaSchema, {
	name: 'RGBA',
	description: 'A CSS rgba() color, such as rgba(255, 0, 0, 0.5).',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#rgb-functions',
});
