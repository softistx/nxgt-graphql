import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { CurrencyScalar } from './currency';

describe('Currency', () => {
	scalarCases(CurrencyScalar, {
		accepted: ['EUR', 'USD', 'JPY', 'CHF', 'XAU', 'XXX', 'SLE', 'VES'],
		refused: [
			'eur',
			'Eur',
			'EU',
			'EURO',
			'ZZZ',
			'FRF',
			'HRK',
			'SLL',
			' EUR',
			'',
			978,
		],
	});
});
