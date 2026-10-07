import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A MongoDB ObjectId as text: 24 hexadecimal digits, in either case, kept
 * as sent. A string on both sides: map it to your driver's `ObjectId` in
 * the resolver.
 */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
	error: 'Invalid ObjectID',
});

export const ObjectIDScalar = zodScalar(objectIdSchema, {
	name: 'ObjectID',
	description: 'A MongoDB ObjectId: 24 hexadecimal digits.',
	specifiedByURL:
		'https://www.mongodb.com/docs/manual/reference/method/ObjectId/',
});
