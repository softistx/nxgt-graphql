import { countryCodeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { countryCodeSchema };

export const CountryCodeScalar = zodScalar(countryCodeSchema, {
	name: 'CountryCode',
	description: 'An ISO 3166-1 alpha-2 country code, such as FR.',
	specifiedByURL: 'https://www.iso.org/iso-3166-country-codes.html',
});
