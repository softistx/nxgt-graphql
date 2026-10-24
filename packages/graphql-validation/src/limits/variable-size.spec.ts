import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	GraphQLInt,
	GraphQLList,
	GraphQLObjectType,
	GraphQLSchema,
} from 'graphql';
import { check, limitOf } from '../../test/limits';
import { maxListCost } from './max-list-cost';

const DIRECTIVE = 'directive @constraint(max: Int) on ARGUMENT_DEFINITION';

/** The issue's schema: a connection of wards, then plain lists of rooms and beds. */
function wardSchema(max: (default_: number) => string) {
	return buildSchema(/* GraphQL */ `
		${DIRECTIVE}
		type Bed { id: ID! }
		type Room { id: ID! beds(first: Int = 50 ${max(50)}): [Bed!]! }
		type Ward { id: ID! rooms(first: Int = 50 ${max(50)}): [Room!]! }
		type Edge { node: Ward! }
		type WardConnection { edges: [Edge!]! }
		type Query { wards(first: Int = 20 ${max(20)}): WardConnection! }
	`);
}

const bounded = (max: number) => () => `@constraint(max: ${max})`;
const unbounded = () => '';

const variable =
	'query($n: Int) { wards(first: $n) { edges { node { rooms(first: $n) { beds(first: $n) { id } } } } } }';
const literal = (n: number) =>
	`{ wards(first: ${n}) { edges { node { rooms(first: ${n}) { beds(first: ${n}) { id } } } } } }`;

const options = { budget: 0, defaultFirst: 10 };

function costOf(source: string, schema: GraphQLSchema, extra = {}) {
	const [error] = check(
		source,
		[maxListCost({ ...options, ...extra })],
		schema,
	);
	return limitOf(error).cost as number;
}

describe('maxListCost: a size given as a variable', () => {
	test('the issue query counts at the declared @constraint(max), as the literal does', () => {
		const schema = wardSchema(bounded(100));
		// beds 1 + 100, rooms 1 + 100 * 101, edges 1 + 100 * (1 + 10101), wards 1 + edges
		expect(costOf(literal(100), schema)).toBe(1_010_202);
		expect(costOf(variable, schema)).toBe(1_010_202);
	});

	test('without a declared max it is read as the SDL default, as before', () => {
		// beds 1 + 50, rooms 1 + 50 * 51, edges 1 + 20 * 2552, wards 1 + edges
		expect(costOf(variable, wardSchema(unbounded))).toBe(51_042);
	});

	test('variableSize stands in when no @constraint(max) is declared', () => {
		const schema = wardSchema(unbounded);
		expect(costOf(variable, schema, { variableSize: 100 })).toBe(1_010_202);
	});

	test('a declared max wins over variableSize', () => {
		const schema = wardSchema(bounded(100));
		expect(costOf(variable, schema, { variableSize: 7 })).toBe(1_010_202);
		expect(costOf(variable, schema, { variableSize: 1000 })).toBe(1_010_202);
	});

	test('it never goes below the SDL default', () => {
		const schema = wardSchema(bounded(5));
		expect(costOf(variable, schema)).toBe(51_042);
		expect(costOf(variable, schema, { variableSize: 3 })).toBe(51_042);
		const none = wardSchema(unbounded);
		expect(costOf(variable, none, { variableSize: 3 })).toBe(51_042);
	});

	test('the operation variable default is ignored: the client can override it', () => {
		const schema = wardSchema(bounded(100));
		const source = variable.replace('$n: Int', '$n: Int = 1');
		expect(costOf(source, schema)).toBe(1_010_202);
	});

	test('a missing argument is unchanged', () => {
		const schema = wardSchema(bounded(100));
		expect(
			costOf('{ wards { edges { node { rooms { beds { id } } } } } }', schema, {
				variableSize: 100,
			}),
		).toBe(51_042);
	});

	test('a connection hands its variable first, at its max, to the lists below', () => {
		const schema = buildSchema(/* GraphQL */ `
			${DIRECTIVE}
			type Item { id: ID! }
			type Conn { edges: [Item!]! }
			type Query { conn(first: Int = 2 @constraint(max: 30)): Conn! }
		`);
		// conn 1 + edges (1 + 30 * 1)
		expect(
			costOf('query($n: Int) { conn(first: $n) { edges { id } } }', schema),
		).toBe(32);
	});
});

describe('maxListCost: an unusable literal size', () => {
	const schema = buildSchema(/* GraphQL */ `
		${DIRECTIVE}
		type Item { id: ID! }
		type Query { items(first: Int = 5 @constraint(max: 40)): [Item!]! }
	`);

	test.each([
		['a negative number', '-1'],
		['a non-integral float', '1.5'],
		['a bad string', '"abc"'],
	])('%s is sized at the declared max', (_name, value) => {
		expect(costOf(`{ items(first: ${value}) { id } }`, schema)).toBe(41);
	});

	test('a usable literal is still its own value', () => {
		expect(costOf('{ items(first: 3) { id } }', schema)).toBe(4);
	});
});

describe('maxListCost: a code-first size argument', () => {
	// No astNode: nothing declares a max.
	const Item = new GraphQLObjectType({
		name: 'Item',
		fields: { id: { type: GraphQLInt } },
	});
	const schema = new GraphQLSchema({
		query: new GraphQLObjectType({
			name: 'Query',
			fields: {
				items: {
					type: new GraphQLList(Item),
					args: { first: { type: GraphQLInt } },
				},
			},
		}),
	});
	const source = 'query($n: Int) { items(first: $n) { id } }';

	test('is sized defaultFirst without variableSize', () => {
		expect(costOf(source, schema)).toBe(11);
	});

	test('is sized variableSize when given', () => {
		expect(costOf(source, schema, { variableSize: 25 })).toBe(26);
	});
});

describe('maxListCost: variableSize option', () => {
	test.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER])(
		'refuses %p',
		(value) => {
			expect(() => maxListCost({ ...options, variableSize: value })).toThrow(
				RangeError,
			);
		},
	);

	test('accepts 0', () => {
		expect(() => maxListCost({ ...options, variableSize: 0 })).not.toThrow();
	});
});

describe('maxListCost: a non-integral or exclusive bound', () => {
	const FLOATS =
		'directive @constraint(max: Float, exclusiveMax: Float) on ARGUMENT_DEFINITION';
	const make = (constraint: string) =>
		buildSchema(/* GraphQL */ `
			${FLOATS}
			type Item { id: ID! }
			type Query { items(first: Int = 5 ${constraint}): [Item!]! }
		`);
	const source = 'query($n: Int) { items(first: $n) { id } }';

	test('a non-integral max is rounded up and wins over variableSize', () => {
		const schema = make('@constraint(max: 100.5)');
		// items 1 + 101 * 1
		expect(costOf(source, schema)).toBe(102);
		expect(costOf(source, schema, { variableSize: 50 })).toBe(102);
	});

	test('exclusiveMax counts as the size', () => {
		const schema = make('@constraint(exclusiveMax: 101)');
		expect(costOf(source, schema)).toBe(102);
		expect(costOf(source, schema, { variableSize: 50 })).toBe(102);
	});

	test('the largest of max and exclusiveMax counts', () => {
		const schema = make('@constraint(max: 20, exclusiveMax: 30)');
		expect(costOf(source, schema)).toBe(31);
	});

	test('a negative bound is no bound', () => {
		const schema = make('@constraint(max: -3)');
		expect(costOf(source, schema)).toBe(6);
		expect(costOf(source, schema, { variableSize: 50 })).toBe(51);
	});

	test('an overflowing bound (1e400, Infinity) is no bound', () => {
		const schema = make('@constraint(max: 1e400)');
		expect(costOf(source, schema)).toBe(6);
		expect(costOf(source, schema, { variableSize: 500 })).toBe(501);
	});

	test('a string bound is read as a number: only an invalid schema has one', () => {
		// buildSchema, not withValidation: the SDL is invalid on purpose.
		const schema = make('@constraint(max: "100")');
		expect(costOf(source, schema)).toBe(101);
	});
});
