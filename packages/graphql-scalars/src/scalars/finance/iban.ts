import { ibanSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { ibanSchema };

export const IBANScalar = zodScalar(ibanSchema, {
	name: 'IBAN',
	description:
		'An International Bank Account Number, electronic form, such as FR1420041010050500013M02606.',
	specifiedByURL: 'https://www.iso.org/standard/81090.html',
});
