import type { z } from 'zod';

/**
 * Refuses `-0`: an integer has no negative zero, and a JSON variable `-0`
 * would otherwise reach the resolver as one (or, for a `bigint`, as `0n`).
 */
export function noNegativeZero<S extends z.ZodNumber | z.ZodNumberFormat>(
	schema: S,
) {
	return schema.refine((n) => !Object.is(n, -0), {
		error: 'Invalid integer: write -0 as 0',
	});
}
