import { ipv6Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { ipv6Schema };

export const IPv6Scalar = zodScalar(ipv6Schema, {
	name: 'IPv6',
	description: 'An IPv6 address.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4291',
});
