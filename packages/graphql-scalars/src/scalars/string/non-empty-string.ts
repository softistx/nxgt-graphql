import { nonEmptyStringSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { nonEmptyStringSchema };

export const NonEmptyStringScalar = zodScalar(nonEmptyStringSchema, {
	name: 'NonEmptyString',
	description: 'A string that is not empty and not only white space.',
});
