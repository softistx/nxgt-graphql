import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An ISO 4217 currency code in force, uppercase (`EUR`, `USD`), from Zod's
 * list: the codes for funds, metals and testing (`XAU`, `XTS`, `XXX`) are
 * in it, a withdrawn code (`FRF`, `HRK`) is not. The list is Zod's, so a
 * newer Zod 4 may know a code an older one refuses.
 */
export const currencySchema = z.currencyCode({
	error: 'Invalid currency: expected an ISO 4217 code in force',
});

export const CurrencyScalar = zodScalar(currencySchema, {
	name: 'Currency',
	description: 'An ISO 4217 currency code, such as EUR.',
	specifiedByURL: 'https://www.iso.org/iso-4217-currency-codes.html',
});
