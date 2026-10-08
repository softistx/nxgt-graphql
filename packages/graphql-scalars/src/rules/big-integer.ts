import { z } from 'zod';
import { noNegativeZero } from './integer';

/**
 * What a 64-bit or unbounded integer looks like on the wire: a decimal
 * string, or a number when it is a safe integer. JSON numbers past 2⁵³ lose
 * precision in most clients, so the way out is always the string.
 */
const wire = z.union(
	[
		z.string().regex(/^(0|-?[1-9]\d*)$/, {
			error: 'Invalid integer: no leading zero and no "-0"',
		}),
		// Past 2⁵³ a number has already been rounded: refused, with a hint.
		noNegativeZero(
			z.int({
				error: (issue) =>
					issue.code === 'too_big' || issue.code === 'too_small'
						? 'Invalid integer: past 2^53, write it as a string'
						: undefined,
			}),
		),
	],
	{ error: 'Invalid integer: expected a decimal string or a safe integer' },
);

/**
 * A `bigint` in the resolvers, held to `range`, and a decimal string on the
 * wire. A literal past 2⁵³ written as a number is refused, not rounded:
 * write it as a string.
 */
export function bigIntegerCodec<R extends z.ZodType<bigint, bigint>>(range: R) {
	return z.codec(wire, range, {
		// `R` is a bigint schema, but the compiler cannot see through `z.input<R>`.
		decode: (value) => BigInt(value) as z.input<R>,
		encode: (value) => value.toString(),
	});
}
