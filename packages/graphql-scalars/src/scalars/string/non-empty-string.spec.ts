import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { NonEmptyStringScalar } from './non-empty-string';

describe('NonEmptyString', () => {
	scalarCases(NonEmptyStringScalar, {
		accepted: ['a', ' a '],
		refused: ['', '   ', '\n\t', 1],
	});
});
