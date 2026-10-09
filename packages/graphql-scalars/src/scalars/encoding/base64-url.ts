import { base64UrlSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { base64UrlSchema };

export const Base64URLScalar = zodScalar(base64UrlSchema, {
	name: 'Base64URL',
	description: 'URL-safe base64 without padding, in its canonical spelling.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4648#section-5',
});
