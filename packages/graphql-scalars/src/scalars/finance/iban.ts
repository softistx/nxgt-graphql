import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * The length of an IBAN in each country of the SWIFT IBAN registry, by
 * length. Zod's `z.iban()` checks only the shape and the check digits, so
 * `XX…` or a German IBAN four characters short would pass it. Built from two
 * copies of the registry that agree on every length (php-iban, ibantools),
 * taking a country either lists; FK was added to the registry in 2023.
 */
const LENGTHS: ReadonlyMap<string, number> = new Map(
	Object.entries({
		15: 'NO',
		16: 'BE',
		18: 'AX DK FI FK FO GL NL SD',
		19: 'MK SI',
		20: 'AT BA EE KZ LT LU MN XK',
		21: 'CH HR LI LV',
		22: 'BG BH CR DE GB GE IE ME RS VA',
		23: 'AE GI IL IQ OM SO TL',
		24: 'AD CZ ES MD PK RO SA SE SK TN VG',
		25: 'LY PT ST',
		26: 'IS TR',
		27: 'BI BL CG DJ FR GF GP GR IT MC MF MQ MR NC PF PM RE SM TF WF YT',
		28: 'AL AZ BY CY DO GT HN HU LB NI PL SV',
		29: 'BR EG PS QA UA',
		30: 'JO KW MU YE',
		31: 'MT SC',
		32: 'LC',
		33: 'RU',
	}).flatMap(([length, countries]) =>
		countries.split(' ').map((country) => [country, Number(length)] as const),
	),
);

/**
 * An IBAN in its electronic form: uppercase, no spaces
 * (`FR1420041010050500013M02606`). Its country must be in the SWIFT IBAN
 * registry, its length the one that country has, and its check digits must
 * hold (ISO 13616, mod 97). The printed form in groups of four is refused,
 * not rewritten.
 */
export const ibanSchema = z
	.iban({ error: 'Invalid IBAN' })
	.refine((iban) => LENGTHS.get(iban.slice(0, 2)) === iban.length, {
		error: 'Invalid IBAN: unknown country, or not its length',
	});

export const IBANScalar = zodScalar(ibanSchema, {
	name: 'IBAN',
	description:
		'An International Bank Account Number, electronic form, such as FR1420041010050500013M02606.',
	specifiedByURL: 'https://www.iso.org/standard/81090.html',
});
