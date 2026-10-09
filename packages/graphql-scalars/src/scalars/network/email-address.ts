import { emailAddressSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { emailAddressSchema };

export const EmailAddressScalar = zodScalar(emailAddressSchema, {
	name: 'EmailAddress',
	description: 'An email address.',
});
