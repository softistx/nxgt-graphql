import { rgbSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { rgbSchema };

export const RGBScalar = zodScalar(rgbSchema, {
	name: 'RGB',
	description: 'A CSS rgb() color, such as rgb(255, 0, 0).',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#rgb-functions',
});
