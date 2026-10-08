import { describe, expect, test } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { CountryCodeScalar, countryCodeSchema } from './country-code';

describe('CountryCode', () => {
	scalarCases(CountryCodeScalar, {
		accepted: ['FR', 'US', 'GB', 'AX', 'ZW', 'SS', 'BQ'],
		refused: [
			'fr',
			'Fr',
			'UK',
			'EU',
			'XK',
			'SU',
			'ZZ',
			'FRA',
			'F',
			' FR',
			'',
			1,
		],
	});

	test('it takes 249 codes, each a region Intl names', () => {
		const names = new Intl.DisplayNames(['en'], {
			type: 'region',
			fallback: 'none',
		});
		const taken: string[] = [];
		for (let a = 65; a <= 90; a++) {
			for (let b = 65; b <= 90; b++) {
				const code = String.fromCharCode(a, b);
				if (countryCodeSchema.safeParse(code).success) taken.push(code);
			}
		}
		expect(taken).toHaveLength(249);
		expect(taken.filter((code) => names.of(code) === undefined)).toEqual([]);
	});
});
