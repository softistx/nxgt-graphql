import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { JSONObjectScalar } from './json-object';

describe('JSONObject', () => {
	scalarCases(JSONObjectScalar, {
		accepted: [{}, { a: 1 }, { a: { b: [null] } }, Object.create(null)],
		refused: [
			null,
			[],
			[{}],
			'text',
			1,
			true,
			new Date(0),
			new Map(),
			{ a: undefined },
			{ a: Number.NaN },
			{ a: -0 },
			undefined,
		],
	});
});
