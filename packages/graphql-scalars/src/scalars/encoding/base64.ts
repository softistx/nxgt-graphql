import { z } from 'zod';
import { isCanonicalBase64 } from '../../rules/base64';
import { zodScalar } from '../../zod-scalar';

/**
 * Standard base64 (RFC 4648, section 4) with its padding, in its one
 * canonical spelling: `YR==` decodes to the same byte as `YQ==` and is
 * refused. The empty string is the encoding of no bytes, and is taken.
 */
export const base64Schema = z
	.base64()
	.refine(isCanonicalBase64, { error: 'Invalid base64' });

export const Base64Scalar = zodScalar(base64Schema, {
	name: 'Base64',
	description: 'Standard base64 with padding, in its canonical spelling.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4648#section-4',
});
