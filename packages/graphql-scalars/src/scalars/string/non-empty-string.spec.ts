import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NonEmptyStringScalar } from './non-empty-string';

describe('NonEmptyString', () => {
	scalarCases(NonEmptyStringScalar, {
		accepted: ['a', ' a ', '\u200b'],
		refused: ['', '   ', '\n\t', '\u00a0', '\ufeff', '\u3000', 1],
	});
});
