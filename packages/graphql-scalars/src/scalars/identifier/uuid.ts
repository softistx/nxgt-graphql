import { uuidSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { uuidSchema };

export const UUIDScalar = zodScalar(uuidSchema, {
	name: 'UUID',
	description: 'A UUID in its 8-4-4-4-12 hexadecimal form.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});
