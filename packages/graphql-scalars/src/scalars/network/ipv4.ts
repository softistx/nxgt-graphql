import { ipv4Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { ipv4Schema };

export const IPv4Scalar = zodScalar(ipv4Schema, {
	name: 'IPv4',
	description: 'An IPv4 address in dotted-quad form.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc791',
});
