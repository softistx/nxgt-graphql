import { z } from 'zod';
import { zodScalar } from '../zod-scalar';

export const emailAddress = z.email();

export const EmailAddressScalar = zodScalar(emailAddress, {
	name: 'EmailAddress',
	description: 'An email address.',
});
