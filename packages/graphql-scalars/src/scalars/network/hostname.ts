import { hostnameSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { hostnameSchema };

export const HostnameScalar = zodScalar(hostnameSchema, {
	name: 'Hostname',
	description: 'A host name, such as api.example.com.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc1123',
});
