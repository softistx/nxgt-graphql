import { cidrv4Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { cidrv4Schema };

export const CIDRv4Scalar = zodScalar(cidrv4Schema, {
	name: 'CIDRv4',
	description: 'An IPv4 block in CIDR notation, such as 10.0.0.0/8.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4632',
});
