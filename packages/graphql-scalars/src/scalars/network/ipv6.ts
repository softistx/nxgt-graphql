import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An IPv6 address, in any of its RFC 4291 text forms: full, compressed
 * (`::1`), or with an embedded IPv4 (`::ffff:192.0.2.1`). No zone (`%eth0`).
 */
export const ipv6Schema = z.ipv6();

export const IPv6Scalar = zodScalar(ipv6Schema, {
	name: 'IPv6',
	description: 'An IPv6 address.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4291',
});
