import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	type GraphQLInterfaceType,
	parse,
	validate,
} from 'graphql';
import { check, limitOf } from '../../test/limits';
import { maxListCost } from './max-list-cost';

const DIRECTIVE = 'directive @constraint(max: Int) on ARGUMENT_DEFINITION';
const options = { budget: 0, defaultFirst: 10 };

function costOf(
	source: string,
	schema: ReturnType<typeof buildSchema>,
	extra = {},
) {
	const [error] = check(
		source,
		[maxListCost({ ...options, ...extra })],
		schema,
	);
	return limitOf(error).cost as number;
}

describe('maxListCost: a declared max on an abstract parent', () => {
	const schema = buildSchema(/* GraphQL */ `
		${DIRECTIVE}
		interface Node { id: ID! kids(first: Int = 1 @constraint(max: 10)): [Node!]! }
		type A implements Node { id: ID! kids(first: Int = 1 @constraint(max: 30)): [Node!]! }
		type B implements Node { id: ID! kids(first: Int = 1 @constraint(max: 20)): [Node!]! }
		type Query { node: Node }
	`);

	test('the largest over the interface and its possible types counts', () => {
		// node 1 + kids (1 + 30)
		expect(
			costOf('query($n: Int) { node { kids(first: $n) { id } } }', schema),
		).toBe(32);
	});

	test('reads the schema once per field, not per selection', () => {
		const types = 500;
		let sdl = `${DIRECTIVE}\ninterface Node { id: ID! kids(first: Int = 1 @constraint(max: 2)): [Node!]! }\n`;
		for (let i = 0; i < types; i++) {
			sdl += `type T${i} implements Node { id: ID! kids(first: Int = 1 @constraint(max: ${i + 2})): [Node!]! }\n`;
		}
		sdl += 'type Query { node: Node }';
		const big = buildSchema(sdl);
		const node = big.getType('Node') as GraphQLInterfaceType;
		const original = big.getPossibleTypes.bind(big);
		let calls = 0;
		big.getPossibleTypes = (type) => {
			if (type === node) calls++;
			return original(type);
		};
		let source = 'query($n: Int) {';
		for (let i = 0; i < 2000; i++)
			source += ` a${i}: node { kids(first: $n) { id } }`;
		source += ' }';
		const [error] = validate(big, parse(source), [
			maxListCost({ ...options, budget: 0 }),
		]);
		expect(calls).toBeLessThanOrEqual(1);
		expect(limitOf(error).cost).toBe(2000 * (1 + 1 + (types + 1)));
	});
});

describe('maxListCost: a mixed abstract parent', () => {
	// One possible type declares no bound: the bound no longer wins alone.
	const schema = buildSchema(/* GraphQL */ `
		${DIRECTIVE}
		interface Node { id: ID! kids(first: Int = 1 @constraint(max: 30)): [Node!]! }
		type A implements Node { id: ID! kids(first: Int = 1 @constraint(max: 30)): [Node!]! }
		type B implements Node { id: ID! kids(first: Int = 1): [Node!]! }
		type Query { node: Node }
	`);
	const source = 'query($n: Int) { node { kids(first: $n) { id } } }';

	test('the largest of the bound and variableSize counts', () => {
		// node 1 + kids (1 + size)
		expect(costOf(source, schema)).toBe(32);
		expect(costOf(source, schema, { variableSize: 500 })).toBe(502);
		expect(costOf(source, schema, { variableSize: 5 })).toBe(32);
	});
});
