import { jsonSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { jsonSchema };

export const JSONScalar = zodScalar(jsonSchema, {
	name: 'JSON',
	description: 'Any JSON value.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc8259',
	literals: 'any',
});
