import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A CSS hexadecimal color: `#` then 3, 4, 6 or 8 hexadecimal digits
 * (`#f00`, `#ff000080`), in either case, kept as sent.
 */
export const hexColorCodeSchema = z
	.string()
	.regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
		error: 'Invalid hex color code',
	});

export const HexColorCodeScalar = zodScalar(hexColorCodeSchema, {
	name: 'HexColorCode',
	description: 'A CSS hexadecimal color, such as #ff0000.',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#hex-notation',
});
