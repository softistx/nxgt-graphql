import { hexColorCodeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { hexColorCodeSchema };

export const HexColorCodeScalar = zodScalar(hexColorCodeSchema, {
	name: 'HexColorCode',
	description: 'A CSS hexadecimal color, such as #ff0000.',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#hex-notation',
});
