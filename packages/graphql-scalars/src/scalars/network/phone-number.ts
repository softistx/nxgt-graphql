import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A phone number in E.164 form: `+`, a country code that does not start
 * with 0, and 7 to 15 digits in all, with no space or separator
 * (`+33612345678`).
 */
export const phoneNumberSchema = z.e164();

export const PhoneNumberScalar = zodScalar(phoneNumberSchema, {
	name: 'PhoneNumber',
	description: 'A phone number in E.164 form, such as +33612345678.',
	specifiedByURL: 'https://www.itu.int/rec/T-REC-E.164',
});
