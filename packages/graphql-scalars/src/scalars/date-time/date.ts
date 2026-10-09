import { dateSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { dateSchema };

export const DateScalar = zodScalar(dateSchema, {
	name: 'Date',
	description: 'A calendar date, YYYY-MM-DD, with no time and no time zone.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339#section-5.6',
});
