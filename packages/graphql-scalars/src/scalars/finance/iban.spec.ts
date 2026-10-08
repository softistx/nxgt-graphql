import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { IBANScalar } from './iban';

describe('IBAN', () => {
	scalarCases(IBANScalar, {
		accepted: [
			'FR1420041010050500013M02606',
			'DE89370400440532013000',
			'GB82WEST12345698765432',
			'NO9386011117947',
			'LC55HEMM000100010012001200023015',
			'EG380019000500000000263180002',
			'UA213223130000026007233566001',
		],
		refused: [
			// a wrong check digit
			'FR1420041010050500013M02607',
			'fr1420041010050500013m02606',
			'FR14 2004 1010 0505 0001 3M02 606',
			'XX1420041010050500013M02606',
			// one character short, one too many, for Germany's length
			'DE8937040044053201300',
			'DE89370400440532013000X',
			// valid check digits, but no such country or not its length
			'XX2820041010050500013M02606',
			'QQ33ABCDEFGHIJKLMNOP',
			'DE41370400440532013',
			'DE783704004405320130001234',
			'FR9112345678901',
			'',
			1,
		],
	});
});
