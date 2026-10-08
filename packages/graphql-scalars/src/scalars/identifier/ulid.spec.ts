import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { ULIDScalar } from './ulid';

describe('ULID', () => {
	scalarCases(ULIDScalar, {
		accepted: [
			'01ARZ3NDEKTSV4RRFFQ69G5FAV',
			'01arz3ndektsv4rrffq69g5fav',
			'01ARZ3ndektsv4RRFFQ69g5fav',
			'7ZZZZZZZZZZZZZZZZZZZZZZZZZ',
		],
		refused: [
			'81ARZ3NDEKTSV4RRFFQ69G5FAV',
			'01ARZ3NDEKTSV4RRFFQ69G5FAI',
			'01ARZ3NDEKTSV4RRFFQ69G5FA',
			'',
		],
	});
});
