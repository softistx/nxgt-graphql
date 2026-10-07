import { z } from 'zod';
import { bigIntegerCodec } from '../../rules/big-integer';
import { zodScalar } from '../../zod-scalar';

/**
 * A signed 64-bit integer, −2⁶³ to 2⁶³ − 1: a `bigint` in the resolvers, a
 * decimal string on the wire (a safe-integer number is accepted on the way
 * in).
 */
export const longSchema = bigIntegerCodec(z.int64());

export const LongScalar = zodScalar(longSchema, {
	name: 'Long',
	description:
		'A signed 64-bit integer, as a decimal string (a safe-integer number is accepted as input).',
});
