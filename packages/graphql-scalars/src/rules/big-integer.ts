import { z } from 'zod';

/**
 * What a 64-bit or unbounded integer looks like on the wire: a decimal
 * string, or a number when it is a safe integer. JSON numbers past 2⁵³ lose
 * precision in most clients, so the way out is always the string.
 */
const wire = z.union(
	[
		z.string().regex(/^(0|-?[1-9]\d*)$/, {
			error: 'Expected a decimal integer, with no leading zero and no "-0"',
		}),
		z.int(),
	],
	{ error: 'Expected a decimal integer string or a safe integer' },
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
