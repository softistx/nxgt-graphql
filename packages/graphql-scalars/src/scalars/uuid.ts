import { z } from 'zod';
import { zodScalar } from '../zod-scalar';

export const uuid = z.uuid();

export const UUIDScalar = zodScalar(uuid, {
	name: 'UUID',
	description: 'A UUID in its 8-4-4-4-12 hexadecimal form.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});
