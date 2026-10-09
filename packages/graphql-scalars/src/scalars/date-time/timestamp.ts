import { timestampSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { timestampSchema };

export const TimestampScalar = zodScalar(timestampSchema, {
	name: 'Timestamp',
	description:
		'An instant, as an integer number of milliseconds since 1970-01-01T00:00:00Z.',
	literals: 'integer',
});
