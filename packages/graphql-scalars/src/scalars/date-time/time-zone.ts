import { timeZoneSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { timeZoneSchema };

export const TimeZoneScalar = zodScalar(timeZoneSchema, {
	name: 'TimeZone',
	description: 'An IANA time zone name, such as Europe/Paris.',
	specifiedByURL: 'https://www.iana.org/time-zones',
});
