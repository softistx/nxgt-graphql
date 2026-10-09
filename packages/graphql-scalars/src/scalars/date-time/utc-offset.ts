import { utcOffsetSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { utcOffsetSchema };

export const UtcOffsetScalar = zodScalar(utcOffsetSchema, {
	name: 'UtcOffset',
	description: 'A UTC offset from -12:00 to +14:00, such as +05:30.',
});
