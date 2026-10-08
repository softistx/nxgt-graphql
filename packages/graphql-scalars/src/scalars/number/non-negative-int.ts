import { z } from 'zod';
import { noNegativeZero } from '../../rules/integer';
import { zodScalar } from '../../zod-scalar';

/** 0 to 2³¹ − 1: 32 bits, as GraphQL's `Int`. */
export const nonNegativeIntSchema = noNegativeZero(z.int32().nonnegative());

export const NonNegativeIntScalar = zodScalar(nonNegativeIntSchema, {
	name: 'NonNegativeInt',
	description: 'An integer from 0 to 2147483647.',
	literals: 'integer',
});
