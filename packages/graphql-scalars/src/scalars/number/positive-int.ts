import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** 1 to 2³¹ − 1: GraphQL's `Int` is 32 bits, so this is too. */
export const positiveIntSchema = z.int32().positive();

export const PositiveIntScalar = zodScalar(positiveIntSchema, {
	name: 'PositiveInt',
	literals: 'integer',
	description: 'An integer from 1 to 2147483647.',
});
