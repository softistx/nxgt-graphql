import { z } from 'zod';
import { bigIntegerCodec } from '../../rules/big-integer';
import { zodScalar } from '../../zod-scalar';

/**
 * An integer of any size: a `bigint` in the resolvers, a decimal string on
 * the wire (a safe-integer number is accepted on the way in).
 */
export const bigIntSchema = bigIntegerCodec(z.bigint());

export const BigIntScalar = zodScalar(bigIntSchema, {
	name: 'BigInt',
	description:
		'An integer of any size, as a decimal string (a safe-integer number is accepted as input).',
	literals: 'integer',
});
