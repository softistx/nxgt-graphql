import { describe, expect, test } from 'bun:test';
import {
	GraphQLObjectType,
	GraphQLSchema,
	graphql,
	parseValue as parseLiteralText,
} from 'graphql';
import { scalarCases } from '../../../test/scalar-cases';
import { JSONScalar } from './json';

const cyclic: Record<string, unknown> = {};
cyclic['self'] = cyclic;
function nest(levels: number): unknown {
	let value: unknown = 0;
	for (let level = 0; level < levels; level++) value = [value];
	return value;
}
const deepest = nest(1000);
const deep = nest(1001);

describe('JSON', () => {
	scalarCases(JSONScalar, {
		accepted: [
			deepest,
			null,
			true,
			0,
			-1.5,
			'text',
			[],
			[1, 'a', null],
			{},
			{ a: { b: [null, false] } },
			Object.create(null),
		],
		refused: [
			undefined,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			-0,
			[-0],
			{ a: -0 },
			1n,
			new Date(0),
			new Map(),
			() => 1,
			{ a: undefined },
			[1, undefined],
			new Array(1),
			cyclic,
			deep,
		],
	});

	test('a shared, not cyclic, object is a JSON value', () => {
		const shared = { a: 1 };
		expect(JSONScalar.parseValue([shared, shared])).toEqual([
			{ a: 1 },
			{ a: 1 },
		]);
	});

	test('reads every kind of literal, objects and lists included', () => {
		const read = (text: string) =>
			JSONScalar.parseLiteral(parseLiteralText(text), undefined);
		expect(read('{ a: [1, 2.5, "x", true, null], b: { c: RED } }')).toEqual({
			a: [1, 2.5, 'x', true, null],
			b: { c: 'RED' },
		});
		expect(read('3')).toBe(3);
		expect(() => read('[-0]')).toThrow('JSON cannot represent this input');
		expect(() => read('-0.0')).toThrow('JSON cannot represent this input');
	});

	test('a variable inside a literal takes its value', async () => {
		const schema = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: 'Query',
				fields: {
					echo: {
						type: JSONScalar,
						args: { v: { type: JSONScalar } },
						resolve: (_: unknown, args: { v?: unknown }) => args.v,
					},
				},
			}),
		});
		const result = await graphql({
			schema,
			source: 'query ($n: JSON) { echo(v: { n: $n, list: [$n] }) }',
			variableValues: { n: 7 },
		});
		expect(result).toEqual({ data: { echo: { n: 7, list: [7] } } });
	});
	test('a variable left out inside a literal is a field left out, a list item null', async () => {
		const schema = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: 'Query',
				fields: {
					echo: {
						type: JSONScalar,
						args: { v: { type: JSONScalar } },
						resolve: (_: unknown, args: { v?: unknown }) => args.v,
					},
				},
			}),
		});
		const result = await graphql({
			schema,
			source: 'query ($n: JSON) { echo(v: { a: $n, list: [$n] }) }',
			variableValues: {},
		});
		expect(result).toEqual({ data: { echo: { list: [null] } } });
	});

	test('a shared container is walked once per depth, not once per use', () => {
		let shared: unknown = 0;
		for (let level = 0; level < 40; level++) shared = [shared, shared];
		const started = performance.now();
		expect(JSONScalar.parseValue(shared)).toBe(shared);
		expect(performance.now() - started).toBeLessThan(1000);
	});

	test('a huge sparse array is refused at its first hole', () => {
		const sparse: unknown[] = [];
		sparse.length = 2 ** 32 - 1;
		expect(() => JSONScalar.parseValue(sparse)).toThrow(
			'JSON cannot represent this input',
		);
	});
});
