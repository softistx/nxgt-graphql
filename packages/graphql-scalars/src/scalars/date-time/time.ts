import { timeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { timeSchema };

export const TimeScalar = zodScalar(timeSchema, {
	name: 'Time',
	description:
		'A time of day with its offset, such as 10:15:30Z (RFC 3339 full-time).',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339#section-5.6',
});
