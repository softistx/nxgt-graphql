import { z } from 'zod';
import { endsInNumber } from '../../rules/hostname';
import { zodScalar } from '../../zod-scalar';

/**
 * A host name: dot-separated labels of letters, digits and hyphens, none
 * starting or ending with a hyphen, each up to 63 characters and 253 in all
 * (RFC 1123). The last label is not a number — all digits, or `0x` and hex
 * digits, which a URL parser reads as IPv4 — so an IPv4 address is not a
 * host name (RFC 1123, 2.1); a single label (`localhost`) is. A trailing dot
 * is allowed, as in DNS. `EmailAddress` and `URL` take their host by the
 * same rule.
 */
export const hostnameSchema = z
	.hostname()
	.refine((name) => !endsInNumber(name), { error: 'Invalid hostname' });

export const HostnameScalar = zodScalar(hostnameSchema, {
	name: 'Hostname',
	description: 'A host name, such as api.example.com.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc1123',
});
