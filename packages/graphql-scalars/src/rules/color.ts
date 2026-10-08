/**
 * The pieces of the CSS comma syntax the color scalars share, written once
 * so `RGB` and `RGBA`, `HSL` and `HSLA` cannot drift apart. Each is the
 * source of a regular expression, in its one canonical spelling: no leading
 * zero, no sign, `", "` between the components.
 */

/** An integer from 0 to 255. */
export const BYTE = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

/** A hue: an integer from 0 to 359 degrees, with no unit (360 is 0). */
export const HUE = '(?:3[0-5]\\d|[12]\\d\\d|[1-9]?\\d)';

/** A percentage: an integer from 0 to 100, then `%`. */
export const PERCENT = '(?:100|[1-9]?\\d)%';

/** An alpha: `0`, `1`, or a fraction such as `0.5`, with no trailing zero. */
export const ALPHA = '(?:0|1|0\\.\\d*[1-9])';

/** The regular expression of `name(a, b, …)` with these components. */
export function cssFunction(name: string, ...components: string[]): RegExp {
	return new RegExp(`^${name}\\(${components.join(', ')}\\)$`);
}
