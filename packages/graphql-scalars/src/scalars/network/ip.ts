import { ipSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { ipSchema };

export const IPScalar = zodScalar(ipSchema, {
	name: 'IP',
	description: 'An IPv4 or IPv6 address.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4291',
});
