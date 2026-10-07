import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** −2³¹ to −1: 32 bits, as GraphQL's `Int`. */
export const negativeIntSchema = z.int32().negative();

export const NegativeIntScalar = zodScalar(negativeIntSchema, {
	name: 'NegativeInt',
	literals: 'integer',
	description: 'An integer from -2147483648 to -1.',
});
