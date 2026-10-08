import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An IPv4 block in CIDR notation: an address and a prefix length 0 to 32
 * (`10.0.0.0/8`). The address is not required to be the block's first.
 */
export const cidrv4Schema = z.cidrv4();

export const CIDRv4Scalar = zodScalar(cidrv4Schema, {
	name: 'CIDRv4',
	description: 'An IPv4 block in CIDR notation, such as 10.0.0.0/8.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4632',
});
