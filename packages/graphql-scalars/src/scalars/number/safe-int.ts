import { z } from 'zod';
import { noNegativeZero } from '../../rules/integer';
import { zodScalar } from '../../zod-scalar';

/** An integer JavaScript holds exactly: ±(2⁵³ − 1). Beyond 32 bits, so it is
 * not GraphQL's `Int`; past 2⁵³ use `Long` or `BigInt`. */
export const safeIntSchema = noNegativeZero(z.int());

export const SafeIntScalar = zodScalar(safeIntSchema, {
	name: 'SafeInt',
	literals: 'integer',
	description: 'An integer from -9007199254740991 to 9007199254740991.',
});
