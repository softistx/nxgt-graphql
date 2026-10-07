import { z } from 'zod';
import { noNegativeZero } from '../../rules/integer';
import { zodScalar } from '../../zod-scalar';

/** −2³¹ to 0: 32 bits, as GraphQL's `Int`. */
export const nonPositiveIntSchema = noNegativeZero(z.int32().nonpositive());

export const NonPositiveIntScalar = zodScalar(nonPositiveIntSchema, {
	name: 'NonPositiveInt',
	literals: 'integer',
	description: 'An integer from -2147483648 to 0.',
});
