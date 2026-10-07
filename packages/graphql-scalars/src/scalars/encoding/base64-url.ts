import { z } from 'zod';
import { isCanonicalBase64Url } from '../../rules/base64';
import { zodScalar } from '../../zod-scalar';

/**
 * URL-safe base64 (RFC 4648, section 5): `-` and `_` for `+` and `/`, no
 * padding, in its one canonical spelling (`YR` for `YQ` is refused).
 */
export const base64UrlSchema = z.base64url().refine(isCanonicalBase64Url, {
	error: 'Invalid base64url',
});

export const Base64URLScalar = zodScalar(base64UrlSchema, {
	name: 'Base64URL',
	description: 'URL-safe base64 without padding, in its canonical spelling.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4648#section-5',
});
