import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** −2³¹ to 0: 32 bits, as GraphQL's `Int`. */
export const nonPositiveIntSchema = z.int32().nonpositive();

export const NonPositiveIntScalar = zodScalar(nonPositiveIntSchema, {
	name: 'NonPositiveInt',
	description: 'An integer from -2147483648 to 0.',
});
