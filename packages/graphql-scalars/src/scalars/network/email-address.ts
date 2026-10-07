import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

export const emailAddressSchema = z.email();

export const EmailAddressScalar = zodScalar(emailAddressSchema, {
	name: 'EmailAddress',
	description: 'An email address.',
});
