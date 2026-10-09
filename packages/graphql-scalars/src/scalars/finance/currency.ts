import { currencySchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { currencySchema };

export const CurrencyScalar = zodScalar(currencySchema, {
	name: 'Currency',
	description: 'An ISO 4217 currency code, such as EUR.',
	specifiedByURL: 'https://www.iso.org/iso-4217-currency-codes.html',
});
