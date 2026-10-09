import { objectIdSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { objectIdSchema };

export const ObjectIDScalar = zodScalar(objectIdSchema, {
	name: 'ObjectID',
	description: 'A MongoDB ObjectId: 24 hexadecimal digits.',
	specifiedByURL:
		'https://www.mongodb.com/docs/manual/reference/method/ObjectId/',
});
