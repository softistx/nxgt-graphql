import { jsonObjectSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { jsonObjectSchema };

export const JSONObjectScalar = zodScalar(jsonObjectSchema, {
	name: 'JSONObject',
	description: 'A JSON object.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc8259#section-4',
	literals: 'any',
});
