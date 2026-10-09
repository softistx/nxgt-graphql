import { durationSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { durationSchema };

export const DurationScalar = zodScalar(durationSchema, {
	name: 'Duration',
	description: 'An ISO 8601 duration, such as P1DT2H or PT0.5S.',
	specifiedByURL: 'https://www.iso.org/iso-8601-date-and-time-format.html',
});
