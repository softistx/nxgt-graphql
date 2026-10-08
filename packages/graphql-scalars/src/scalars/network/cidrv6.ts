import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An IPv6 block in CIDR notation: an address and a prefix length 0 to 128
 * (`2001:db8::/32`). The address is not required to be the block's first.
 */
export const cidrv6Schema = z.cidrv6();

export const CIDRv6Scalar = zodScalar(cidrv6Schema, {
	name: 'CIDRv6',
	description: 'An IPv6 block in CIDR notation, such as 2001:db8::/32.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4291',
});
