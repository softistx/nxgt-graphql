import { describe, expect, test } from 'bun:test';
import { GraphQLObjectType, GraphQLSchema, graphql } from 'graphql';
import { scalarCases } from '../../../test/scalar-cases';
import { VoidScalar } from './void';

describe('Void', () => {
	scalarCases(VoidScalar, {
		accepted: [null],
		refused: [undefined, 0, '', false, {}, 'null'],
	});

	test('a field of type Void answers null when its resolver returns nothing', async () => {
		const schema = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: 'Query',
				fields: { ping: { type: VoidScalar, resolve: () => undefined } },
			}),
		});
		expect(await graphql({ schema, source: '{ ping }' })).toEqual({
			data: { ping: null },
		});
	});
});
