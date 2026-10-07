import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** 0 to 2³¹ − 1: 32 bits, as GraphQL's `Int`. */
export const nonNegativeIntSchema = z.int32().nonnegative();

export const NonNegativeIntScalar = zodScalar(nonNegativeIntSchema, {
	name: 'NonNegativeInt',
	description: 'An integer from 0 to 2147483647.',
});
