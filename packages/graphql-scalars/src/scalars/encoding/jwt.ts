import { jwtSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { jwtSchema };

export const JWTScalar = zodScalar(jwtSchema, {
	name: 'JWT',
	description:
		'A signed JSON Web Token in compact form. Its signature is not verified.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc7519',
});
