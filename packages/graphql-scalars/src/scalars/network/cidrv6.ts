import { cidrv6Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { cidrv6Schema };

export const CIDRv6Scalar = zodScalar(cidrv6Schema, {
	name: 'CIDRv6',
	description: 'An IPv6 block in CIDR notation, such as 2001:db8::/32.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4291',
});
