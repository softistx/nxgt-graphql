import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';
import { ipv4Schema } from './ipv4';
import { ipv6Schema } from './ipv6';

/**
 * An IPv4 or an IPv6 address, as `IPv4` and `IPv6` take them.
 */
export const ipSchema = z.union([ipv4Schema, ipv6Schema], {
	error: 'Invalid IP address: expected IPv4 or IPv6',
});

export const IPScalar = zodScalar(ipSchema, {
	name: 'IP',
	description: 'An IPv4 or IPv6 address.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4291',
});
