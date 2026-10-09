import { localTimeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { localTimeSchema };

export const LocalTimeScalar = zodScalar(localTimeSchema, {
	name: 'LocalTime',
	description: 'A time of day with no offset, such as 10:15 or 10:15:30.',
});
