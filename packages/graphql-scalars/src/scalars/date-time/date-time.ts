import { dateTimeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { dateTimeSchema };

export const DateTimeScalar = zodScalar(dateTimeSchema, {
	name: 'DateTime',
	description: 'An instant: an RFC 3339 date-time with its offset.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339',
});
