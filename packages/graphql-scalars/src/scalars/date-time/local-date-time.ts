import { localDateTimeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { localDateTimeSchema };

export const LocalDateTimeScalar = zodScalar(localDateTimeSchema, {
	name: 'LocalDateTime',
	description: 'A date and a time with no offset, such as 2024-03-10T10:15:30.',
});
