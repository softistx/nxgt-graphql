import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	GraphQLInt,
	type GraphQLInterfaceType,
	GraphQLList,
	GraphQLObjectType,
	GraphQLScalarType,
	GraphQLSchema,
	getIntrospectionQuery,
	Kind,
	parse,
	validate,
	versionInfo,
} from 'graphql';

const INTROSPECTION_COST_FLOOR = 100;

/** Generous: the walk takes a fraction of it on a laptop, the old walk, quadratic in the possible types, took about 1.2 times it. The call count below is the real guard. */
const TIME_BOUND_MS = 1500;

import { check, cycleQuery, limitOf } from '../../test/limits';
import { maxDepth } from './max-depth';
import { maxListCost } from './max-list-cost';

const options = { budget: 1000, defaultFirst: 10 };

/** The cost of `source`, read from the error a budget of 0 raises. */
function costOf(
	source: string,
	extra = {},
	schema?: Parameters<typeof check>[2],
) {
	const [error] = check(
		source,
		[maxListCost({ ...options, budget: 0, ...extra })],
		schema,
	);
	return limitOf(error).cost as number;
}

describe('maxListCost', () => {
	test('refuses the issue query', () => {
		const [error, ...rest] = check(cycleQuery, [maxListCost(options)]);
		expect(rest).toHaveLength(0);
		expect(limitOf(error).code).toBe('QUERY_TOO_COSTLY');
		expect(limitOf(error).limit).toBe(1000);
		expect(limitOf(error).cost as number).toBeGreaterThan(1000);
		expect(error?.message).toBe(
			`Operation costs ${limitOf(error).cost}, more than the 1000 allowed`,
		);
		expect(error?.nodes?.[0]?.kind).toBe(Kind.OPERATION_DEFINITION);
	});

	test('counts the issue query: the SDL default of 100 at each level', () => {
		// from the inside out: items { id } = 1 + 100 * 1, then each
		// items { folder { … } } = 1 + 100 * (1 + inner)
		let items = 1 + 100 * 1;
		for (let level = 0; level < 3; level++) items = 1 + 100 * (1 + items);
		const expected = 1 + items; // the `folder(id:)` field above
		expect(costOf(cycleQuery)).toBe(expected);
	});

	test('a cheap query passes', () => {
		expect(
			check('{ folder(id: "1") { id items(first: 5) { id } } }', [
				maxListCost(options),
			]),
		).toEqual([]);
	});

	test('names the operation', () => {
		const [error] = check(
			'query Big { folder(id: "1") { items(first: 5000) { id } } }',
			[maxListCost(options)],
		);
		expect(error?.message).toBe(
			`Operation "Big" costs ${limitOf(error).cost}, more than the 1000 allowed`,
		);
	});

	test('a literal size is used as is', () => {
		// folder 1 + id 1 + items 1 + 7 * id 1
		expect(costOf('{ folder(id: "1") { id items(first: 7) { id } } }')).toBe(
			10,
		);
		expect(costOf('{ folder(id: "1") { items(first: 0) { id } } }')).toBe(2);
	});

	test('a variable uses the SDL default', () => {
		const source =
			'query($n: Int) { folder(id: "1") { items(first: $n) { id } } }';
		// default 100 declared by the schema
		expect(costOf(source)).toBe(1 + 1 + 100);
	});

	test('a variable with no SDL default uses defaultFirst', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query { items(first: Int): [Item!]! }
		`);
		expect(
			costOf('query($n: Int) { items(first: $n) { id } }', {}, schema),
		).toBe(1 + 10);
	});

	test('a missing size argument uses the SDL default, else defaultFirst', () => {
		expect(costOf('{ folder(id: "1") { items { id } } }')).toBe(1 + 1 + 100);
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query { items: [Item!]! }
		`);
		expect(costOf('{ items { id } }', {}, schema)).toBe(1 + 10);
	});

	test('a negative literal falls back to the default and never lowers the cost', () => {
		const alone = costOf('{ folder(id: "1") { items(first: 50) { id } } }');
		const withNegative = costOf(`{
			folder(id: "1") {
				items(first: 50) { id }
				other: items(first: -1000) { id }
			}
		}`);
		expect(withNegative).toBeGreaterThanOrEqual(alone);
		// the negative one costs like the SDL default, 100
		expect(withNegative).toBe(alone + 1 + 100);
	});

	test('a negative size never makes a subtree cost less than nothing', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query { items(first: Int): [Item!]! }
		`);
		expect(
			costOf('{ items(first: -1000) { id } }', { defaultFirst: 0 }, schema),
		).toBe(1);
		expect(costOf('{ items(first: -1) { id } }', {}, schema)).toBe(1 + 10);
	});

	test('reads sizeArguments in order, last and limit by default', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query { a(last: Int): [Item!]! b(limit: Int): [Item!]! c(count: Int): [Item!]! }
		`);
		expect(costOf('{ a(last: 3) { id } }', {}, schema)).toBe(1 + 3);
		expect(costOf('{ b(limit: 4) { id } }', {}, schema)).toBe(1 + 4);
		expect(costOf('{ c(count: 4) { id } }', {}, schema)).toBe(1 + 10);
		expect(
			costOf('{ c(count: 4) { id } }', { sizeArguments: ['count'] }, schema),
		).toBe(1 + 4);
	});

	test('takes the largest of several size arguments', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query { items(first: Int, last: Int, limit: Int): [Item!]! }
		`);
		expect(
			costOf('{ items(first: 0, limit: 1000000) { id } }', {}, schema),
		).toBe(1 + 1000000);
		expect(costOf('{ items(first: 3, last: 5) { id } }', {}, schema)).toBe(
			1 + 5,
		);
		// a size argument left out and without a default says nothing
		expect(costOf('{ items(first: 3) { id } }', {}, schema)).toBe(1 + 3);
	});

	test('a size argument given but unusable counts for its default, else defaultFirst', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query { items(first: Int, limit: Int = 7): [Item!]! }
		`);
		expect(
			costOf(
				'query($n: Int) { items(first: 2, limit: $n) { id } }',
				{},
				schema,
			),
		).toBe(1 + 7);
		expect(
			costOf(
				'query($n: Int) { items(first: $n, limit: 2) { id } }',
				{},
				schema,
			),
		).toBe(1 + 10);
	});

	test('an interface parent takes the largest default over its possible types', () => {
		const schema = buildSchema(`
			interface Node { id: ID! kids(first: Int = 1): [Node!]! }
			type Folder implements Node { id: ID! kids(first: Int = 100000): [Node!]! }
			type Leaf implements Node { id: ID! kids(first: Int = 2): [Node!]! }
			type Query { node: Node }
		`);
		// node 1 + kids 1 + 100000 * id 1
		expect(costOf('{ node { kids { id } } }', {}, schema)).toBe(1 + 1 + 100000);
		// a literal still counts for every type: the largest default is not used
		expect(costOf('{ node { kids(first: 5) { id } } }', {}, schema)).toBe(
			1 + 1 + 5,
		);
	});

	test('a string literal holding a canonical integer is a size', () => {
		const schema = buildSchema(`
			scalar Long
			type Item { id: ID! }
			type Query { items(limit: Long): [Item!]! }
		`);
		expect(costOf('{ items(limit: "100000000") { id } }', {}, schema)).toBe(
			1 + 100000000,
		);
		expect(costOf('{ items(limit: "0") { id } }', {}, schema)).toBe(1);
		// not canonical: as if absent
		expect(costOf('{ items(limit: "007") { id } }', {}, schema)).toBe(1 + 10);
		expect(costOf('{ items(limit: "-5") { id } }', {}, schema)).toBe(1 + 10);
		expect(costOf('{ items(limit: "1e3") { id } }', {}, schema)).toBe(1 + 10);
	});

	test('a string default, a float literal and a float default are sizes', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query {
				s(limit: String = "1000"): [Item!]!
				g(first: Float): [Item!]!
				h(first: Float = 1000.0): [Item!]!
			}
		`);
		expect(costOf('{ s { id } }', {}, schema)).toBe(1 + 1000);
		expect(costOf('{ g(first: 1000.0) { id } }', {}, schema)).toBe(1 + 1000);
		expect(costOf('{ g(first: 1e3) { id } }', {}, schema)).toBe(1 + 1000);
		expect(costOf('{ h { id } }', {}, schema)).toBe(1 + 1000);
		// not integral, negative or not canonical: unusable
		expect(costOf('{ g(first: 1.5) { id } }', {}, schema)).toBe(1 + 10);
		expect(costOf('{ g(first: -1000.0) { id } }', {}, schema)).toBe(1 + 10);
		expect(costOf('{ g(first: 1e400) { id } }', {}, schema)).toBe(1 + 10);
	});

	test('walks a schema of many possible types in time bounded by the document', () => {
		const types = 2000;
		let sdl = 'interface Node { id: ID! kids(first: Int = 5): [Node!]! }\n';
		for (let i = 0; i < types; i++) {
			sdl += `type T${i} implements Node { id: ID! kids(first: Int = ${i + 1}): [Node!]! }\n`;
		}
		sdl += 'type Query { node: Node }';
		const schema = buildSchema(sdl);
		let source = '{';
		for (let i = 0; i < 10000; i++) source += ` a${i}: node { kids { id } }`;
		source += ' }';
		const node = schema.getType('Node') as GraphQLInterfaceType;
		const original = schema.getPossibleTypes.bind(schema);
		let calls = 0;
		schema.getPossibleTypes = (type) => {
			if (type === node) calls++;
			return original(type);
		};
		const start = performance.now();
		const [error] = validate(schema, parse(source), [
			maxListCost({ ...options, budget: 0 }),
		]);
		const elapsed = performance.now() - start;
		// the schema's part is read once per (parent, field), not per alias
		expect(calls).toBeLessThanOrEqual(1);
		// the largest default over the possible types, once per alias
		expect(limitOf(error).cost).toBe(10000 * (1 + 1 + types));
		expect(elapsed).toBeLessThan(TIME_BOUND_MS);
	});

	test('a bigint default is a size, as graphql-tools and code-first schemas hold it', () => {
		const first =
			versionInfo.major >= 17
				? { type: GraphQLInt, default: { value: 1_000_000n } }
				: { type: GraphQLInt, defaultValue: 1_000_000n };
		const Item = new GraphQLObjectType({
			name: 'Item',
			fields: { id: { type: GraphQLInt } },
		});
		const schema = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: 'Query',
				fields: {
					items: { type: new GraphQLList(Item), args: { first } as any },
				},
			}),
		});
		expect(costOf('{ items { id } }', {}, schema)).toBe(1 + 1_000_000);
		const Long = new GraphQLScalarType({ name: 'Long' });
		const huge = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: 'Query',
				fields: {
					items: {
						type: new GraphQLList(Item),
						args: {
							first:
								versionInfo.major >= 17
									? { type: Long, default: { value: 10n ** 400n } }
									: { type: Long, defaultValue: 10n ** 400n },
						} as any,
					},
				},
			}),
		});
		expect(costOf('{ items { id } }', {}, huge)).toBe(Number.MAX_SAFE_INTEGER);
	});

	test('mutating the sizeArguments array after creation changes nothing', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query {
				items(first: Int = 3, limit: Int = 9): [Item!]!
				other(first: Int = 3, limit: Int = 9): [Item!]!
			}
		`);
		const names = ['first'];
		const rule = maxListCost({ ...options, budget: 0, sizeArguments: names });
		const cost = (field: string) =>
			limitOf(check(`{ ${field} { id } }`, [rule], schema)[0]).cost;
		expect(cost('items')).toBe(1 + 3);
		names.push('limit');
		names[0] = 'limit';
		// a field not seen yet is still sized by the arguments given at creation
		expect(cost('other')).toBe(1 + 3);
	});

	test('a nested list is one list, and a non-list multiplies by 1', () => {
		const schema = buildSchema(`
			type Item { id: ID! }
			type Query { grid(first: Int): [[Item!]!]! one: Item }
		`);
		expect(costOf('{ grid(first: 3) { id } }', {}, schema)).toBe(1 + 3);
		expect(costOf('{ one { id } }', {}, schema)).toBe(2);
	});

	test('a scalar list costs 1', () => {
		const schema = buildSchema('type Query { tags: [String!]! }');
		expect(costOf('{ tags }', {}, schema)).toBe(1);
	});

	test('follows named fragments and inline fragments', () => {
		const source = `
			query { folder(id: "1") { ...F ... on Folder { items(first: 2) { id } } } }
			fragment F on Folder { items(first: 3) { id } }
		`;
		// folder 1 + (items 1 + 3) + (items 1 + 2)
		expect(costOf(source)).toBe(1 + 4 + 3);
	});

	test('a fragment used twice counts twice', () => {
		const source = `
			query { folder(id: "1") { a: items(first: 3) { ...I } b: items(first: 3) { ...I } } }
			fragment I on Item { id }
		`;
		expect(costOf(source)).toBe(1 + 2 * (1 + 3));
	});

	test('a fragment cycle does not loop', () => {
		const source = `
			query { folder(id: "1") { ...A } }
			fragment A on Folder { items(first: 1) { folder { ...B } } }
			fragment B on Folder { items(first: 1) { folder { ...A } } }
		`;
		expect(() => check(source, [maxListCost(options)])).not.toThrow();
	});

	test('abstract types sum their branches', () => {
		const schema = buildSchema(`
			interface Node { id: ID! }
			type A implements Node { id: ID! xs(first: Int): [A!]! }
			type B implements Node { id: ID! ys(first: Int): [B!]! }
			type Query { nodes(first: Int): [Node!]! }
		`);
		const source = `{ nodes(first: 2) { id ... on A { xs(first: 3) { id } } ... on B { ys(first: 4) { id } } } }`;
		// nodes 1 + 2 * (id 1 + (xs 1 + 3) + (ys 1 + 4))
		expect(costOf(source, {}, schema)).toBe(1 + 2 * (1 + 4 + 5));
	});

	test('__typename costs nothing', () => {
		expect(costOf('{ __typename folder(id: "1") { __typename id } }')).toBe(2);
	});

	test('introspection is costed by the size of the schema', () => {
		const schema = buildSchema('type Query { a: Int }');
		const cost = costOf('{ __schema { directives { name } } }', {}, schema);
		// __schema 1 + directives 1 + (the longest list of the schema: the
		// introspection types' own, e.g. __DirectiveLocation's values) * name 1
		expect(cost).toBeGreaterThan(1 + 1 + schema.getDirectives().length);
		const types = costOf('{ __schema { types { name } } }', {}, schema);
		expect(types).toBe(1 + 1 + Object.keys(schema.getTypeMap()).length);
	});

	test('a query repeating aliased introspection is refused', () => {
		const inner =
			'types { fields { type { fields { type { fields { name } } } } } }';
		let source = '{';
		for (let i = 0; i < 500; i++) source += ` a${i}: __schema { ${inner} }`;
		source += ' }';
		const [error] = check(source, [
			maxListCost({ budget: 100_000, defaultFirst: 10 }),
		]);
		expect(limitOf(error).code).toBe('QUERY_TOO_COSTLY');
	});

	test('the standard introspection query is costed, and ignoreIntrospection skips it', () => {
		const cost = costOf(getIntrospectionQuery());
		expect(cost).toBeGreaterThan(INTROSPECTION_COST_FLOOR);
		const rule = maxListCost({
			...options,
			budget: 0,
			ignoreIntrospection: true,
		});
		expect(check(getIntrospectionQuery(), [rule])).toEqual([]);
	});

	test('__type is costed too', () => {
		expect(
			costOf('{ __type(name: "Folder") { fields { name } } }'),
		).toBeGreaterThan(3);
	});

	test('stays fast and finite on a hostile query', () => {
		let source = 'fragment F0 on Folder { id }';
		for (let i = 1; i < 60; i++) {
			source += ` fragment F${i} on Folder { items(first: 2147483647) { folder { ...F${i - 1} } } }`;
		}
		source += ' query { folder(id: "1") { ...F59 } }';
		const cost = costOf(source);
		expect(Number.isFinite(cost)).toBe(true);
		expect(cost).toBeGreaterThan(1000);
	});

	test('reports one error per operation', () => {
		const source = `
			query A { folder(id: "1") { items(first: 5000) { id } } }
			query B { folder(id: "1") { id } }
			query C { folder(id: "1") { items(first: 6000) { id } } }
		`;
		expect(check(source, [maxListCost(options)])).toHaveLength(2);
	});

	test('refuses an unusable option', () => {
		expect(() => maxListCost({ ...options, budget: -1 })).toThrow(RangeError);
		expect(() => maxListCost({ ...options, defaultFirst: 1.5 })).toThrow(
			RangeError,
		);
	});

	test('refuses a budget or a default the clamped cost could never exceed', () => {
		const huge = Number.MAX_SAFE_INTEGER;
		expect(() => maxListCost({ ...options, budget: huge })).toThrow(RangeError);
		expect(() => maxListCost({ ...options, budget: huge + 1 })).toThrow(
			RangeError,
		);
		expect(() => maxListCost({ ...options, defaultFirst: huge })).toThrow(
			RangeError,
		);
		expect(() => maxListCost({ ...options, budget: huge - 1 })).not.toThrow();
	});
});

const connectionSchema = buildSchema(/* GraphQL */ `
	interface Feed { items(first: Int = 3): ItemConnection! }
	type Blog implements Feed { items(first: Int = 20): ItemConnection! }
	type PageInfo { hasNext: Boolean! }
	type Item { id: ID! children(first: Int): ItemConnection! }
	type ItemEdge { node: Item! }
	type ItemConnection {
		edges: [ItemEdge!]!
		nodes: [Item!]!
		pageInfo: PageInfo!
		recent(first: Int): [Item!]!
	}
	type Wrapper {
		inner: ItemConnection!
		sub(first: Int): ItemConnection!
	}
	type Query {
		items(first: Int): ItemConnection!
		sized(first: Int = 7): ItemConnection!
		wrapped(first: Int): Wrapper!
		feed: Feed
	}
`);

/** The cost of `source` against the connection schema, defaultFirst 10. */
const connectionCost = (source: string) => costOf(source, {}, connectionSchema);

describe('maxListCost on a connection', () => {
	test('sizes the lists below a connection from its first (the issue query)', () => {
		// innermost: edges { node { id } } = 1 + 100 * 2 = 201; children = 202;
		// node { children } = 203; edges = 1 + 100 * 203 = 20301; items = 20302
		const source = `query { items(first: 100) { edges { node { children(first: 100) { edges { node { id } } } } } } }`;
		expect(costOf(source, { defaultFirst: 50 }, connectionSchema)).toBe(20302);
	});

	test('a small first costs less than defaultFirst would', () => {
		// edges 1 + 2 * 2 = 5, items 6 (defaultFirst 10 would give 22)
		expect(
			connectionCost('{ items(first: 2) { edges { node { id } } } }'),
		).toBe(6);
	});

	test('edges and nodes each use the connection first', () => {
		// edges 1 + 3 * 2 = 7, nodes 1 + 3 = 4, items 1 + 11
		const source = '{ items(first: 3) { edges { node { id } } nodes { id } } }';
		expect(connectionCost(source)).toBe(12);
	});

	test('pageInfo passes the size through, and costs its own fields', () => {
		const source =
			'{ items(first: 3) { pageInfo { hasNext } edges { node { id } } } }';
		expect(connectionCost(source)).toBe(1 + 2 + 7);
	});

	test('a connection stating nothing leaves its lists at defaultFirst', () => {
		expect(connectionCost('{ items { edges { node { id } } } }')).toBe(22);
	});

	test('a list with its own size uses it, and consumes the connection size', () => {
		expect(
			connectionCost('{ items(first: 100) { recent(first: 2) { id } } }'),
		).toBe(4);
		// recent 1 + 2 * (children 1 + edges (1 + 10 * 2)) = 45: the 100 is spent
		const source =
			'{ items(first: 100) { recent(first: 2) { children { edges { node { id } } } } } }';
		expect(connectionCost(source)).toBe(46);
	});

	test('a list below a list does not see the size of the connection', () => {
		// edges 1 + 100 * (node 1 + children 1 + edges (1 + 10 * 2)) = 2501
		const source =
			'{ items(first: 100) { edges { node { children { edges { node { id } } } } } } }';
		expect(connectionCost(source)).toBe(1 + 1 + 100 * (1 + 1 + 21));
	});

	test('a variable first says the SDL default, else defaultFirst', () => {
		const bare =
			'query ($n: Int) { items(first: $n) { edges { node { id } } } }';
		expect(connectionCost(bare)).toBe(22);
		const sized =
			'query ($n: Int) { sized(first: $n) { edges { node { id } } } }';
		expect(connectionCost(sized)).toBe(1 + 1 + 7 * 2);
		expect(connectionCost('{ sized { edges { node { id } } } }')).toBe(
			1 + 1 + 7 * 2,
		);
	});

	test('a negative first never lowers the cost', () => {
		const source = '{ items(first: -5) { edges { node { id } } } }';
		expect(connectionCost(source)).toBe(22);
	});

	test('an interface parent takes the largest default over its possible types', () => {
		// edges 1 + 20 * 2 = 41, items 42, feed 43
		expect(connectionCost('{ feed { items { edges { node { id } } } } }')).toBe(
			43,
		);
	});

	test('a wrapper passes the size through, a nested sized field replaces it', () => {
		const wrapped = '{ wrapped(first: 3) { inner { edges { node { id } } } } }';
		expect(connectionCost(wrapped)).toBe(1 + 1 + 7);
		const nested =
			'{ wrapped(first: 100) { sub(first: 2) { edges { node { id } } } } }';
		expect(connectionCost(nested)).toBe(1 + 1 + 5);
	});

	test('inline fragments pass the size through', () => {
		const source =
			'{ items(first: 2) { ... on ItemConnection { edges { node { id } } } } }';
		expect(connectionCost(source)).toBe(6);
	});

	test('a fragment spread under two sizes is costed under each', () => {
		const source = `
			query { a: items(first: 2) { ...C } b: items(first: 5) { ...C } }
			fragment C on ItemConnection { edges { node { id } } }
		`;
		// a 1 + (1 + 2 * 2) = 6, b 1 + (1 + 5 * 2) = 12
		expect(connectionCost(source)).toBe(18);
	});

	test('many fragments under many sizes stay fast, and never under-count', () => {
		const sizes = 200;
		const chain = 200;
		let source = '';
		for (let i = 0; i < chain - 1; i++) {
			source += ` fragment F${i} on ItemConnection { ...F${i + 1} }`;
		}
		source += ` fragment F${chain - 1} on ItemConnection { edges { node { id } } }`;
		source += ' query {';
		let exact = 0;
		for (let k = 1; k <= sizes; k++) {
			source += ` a${k}: items(first: ${k}) { ...F0 }`;
			exact += 1 + 1 + 2 * k;
		}
		source += ' }';
		const start = performance.now();
		const cost = connectionCost(source);
		expect(performance.now() - start).toBeLessThan(TIME_BOUND_MS);
		// beyond a few sizes per fragment, a size is rounded up to a power of two
		expect(cost).toBeGreaterThanOrEqual(exact);
		expect(cost).toBeLessThanOrEqual(2 * exact);
	});
});

describe('maxDepth and maxListCost together', () => {
	test('each reports its own error for the same operation', () => {
		const errors = check(cycleQuery, [
			maxDepth({ depth: 8 }),
			maxListCost(options),
		]);
		expect(errors.map((e) => limitOf(e).code).sort()).toEqual([
			'QUERY_TOO_COSTLY',
			'QUERY_TOO_DEEP',
		]);
	});

	test('a small query passes both', () => {
		expect(
			check('{ folder(id: "1") { id items(first: 3) { id } } }', [
				maxDepth({ depth: 8 }),
				maxListCost(options),
			]),
		).toEqual([]);
	});
});
