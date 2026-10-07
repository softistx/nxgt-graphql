import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An IPv4 address in dotted-quad form, each part 0 to 255 with no leading
 * zero (`192.168.0.1`).
 */
export const ipv4Schema = z.ipv4();

export const IPv4Scalar = zodScalar(ipv4Schema, {
	name: 'IPv4',
	description: 'An IPv4 address in dotted-quad form.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc791',
});
