import { z } from 'zod';
import { ALPHA, cssFunction, HUE, PERCENT } from '../../rules/color';
import { zodScalar } from '../../zod-scalar';

/**
 * A CSS `hsla()` color in comma syntax, `hsla(120, 100%, 50%, 0.5)`: as
 * `HSL`, then an alpha from 0 to 1 (`0`, `1`, or a fraction such as `0.5`,
 * with no trailing zero).
 */
export const hslaSchema = z
	.string()
	.regex(cssFunction('hsla', HUE, PERCENT, PERCENT, ALPHA), {
		error:
			'Invalid HSLA color: expected hsla(H, S%, L%, A), H 0 to 359, S and L 0 to 100, A 0 to 1',
	});

export const HSLAScalar = zodScalar(hslaSchema, {
	name: 'HSLA',
	description: 'A CSS hsla() color, such as hsla(120, 100%, 50%, 0.5).',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#the-hsl-notation',
});
