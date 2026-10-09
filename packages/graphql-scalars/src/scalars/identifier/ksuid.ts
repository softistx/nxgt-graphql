import { ksuidSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { ksuidSchema };

export const KSUIDScalar = zodScalar(ksuidSchema, {
	name: 'KSUID',
	description: 'A KSUID: 27 characters of base62.',
	specifiedByURL: 'https://github.com/segmentio/ksuid',
});
