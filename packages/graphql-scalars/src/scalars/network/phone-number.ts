import { phoneNumberSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { phoneNumberSchema };

export const PhoneNumberScalar = zodScalar(phoneNumberSchema, {
	name: 'PhoneNumber',
	description: 'A phone number in E.164 form, such as +33612345678.',
	specifiedByURL: 'https://www.itu.int/rec/T-REC-E.164',
});
