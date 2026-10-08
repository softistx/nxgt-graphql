import { z } from 'zod';
import { cssFunction, HUE, PERCENT } from '../../rules/color';
import { zodScalar } from '../../zod-scalar';

/**
 * A CSS `hsl()` color in comma syntax, `hsl(120, 100%, 50%)`: a hue from 0
 * to 359 degrees with no unit (360 is 0), then saturation and lightness as
 * integer percentages from 0% to 100%. No alpha: that is `HSLA`.
 */
export const hslSchema = z
	.string()
	.regex(cssFunction('hsl', HUE, PERCENT, PERCENT), {
		error:
			'Invalid HSL color: expected hsl(H, S%, L%), H 0 to 359, S and L 0 to 100',
	});

export const HSLScalar = zodScalar(hslSchema, {
	name: 'HSL',
	description: 'A CSS hsl() color, such as hsl(120, 100%, 50%).',
	specifiedByURL: 'https://www.w3.org/TR/css-color-4/#the-hsl-notation',
});
