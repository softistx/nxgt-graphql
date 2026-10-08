import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * No value: the type of a field that only acts, such as a mutation with
 * nothing to return. `null` is the one value; GraphQL writes it without
 * asking the scalar, and a resolver returning anything else is refused.
 */
export const voidSchema = z.null({ error: 'Expected no value' });

export const VoidScalar = zodScalar(voidSchema, {
	name: 'Void',
	description: 'No value: always null.',
});
