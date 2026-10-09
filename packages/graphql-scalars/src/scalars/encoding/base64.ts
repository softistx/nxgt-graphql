import { base64Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { base64Schema };

export const Base64Scalar = zodScalar(base64Schema, {
	name: 'Base64',
	description: 'Standard base64 with padding, in its canonical spelling.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc4648#section-4',
});
