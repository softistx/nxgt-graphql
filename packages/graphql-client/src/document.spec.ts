import { describe, expect, test } from 'bun:test';
import { parse } from 'graphql';
import { operationOf } from './document';

/** Like the client preset's `TypedDocumentString`: a String that carries its type. */
class TypedDocumentString<TResult, TVariables> extends String {
	declare __apiType?: (variables: TVariables) => TResult;
	constructor(
		private readonly value: string,
		public __meta__?: Record<string, unknown>,
	) {
		super(value);
	}
	override toString(): string {
		return this.value;
	}
}

describe('operationOf', () => {
	test('a DocumentNode: printed text, name and kind', () => {
		const operation = operationOf(
			parse('mutation Rename($name: String!) { rename(name: $name) }') as never,
		);
		expect(operation).toEqual({
			query: 'mutation Rename($name: String!) {\n  rename(name: $name)\n}',
			operationName: 'Rename',
			kind: 'mutation',
		});
	});

	test('a TypedDocumentString is kept as written', () => {
		const text = 'query   Viewer { viewer { id } }';
		const operation = operationOf(new TypedDocumentString(text) as never);
		expect(operation).toEqual({
			query: text,
			operationName: 'Viewer',
			kind: 'query',
		});
	});

	test('a plain string is kept as written', () => {
		const text = 'subscription Tick { tick }';
		expect(operationOf(text as never)).toEqual({
			query: text,
			operationName: 'Tick',
			kind: 'subscription',
		});
	});

	test('the anonymous shorthand is a query without a name', () => {
		const operation = operationOf('{ viewer { id } }' as never);
		expect(operation.kind).toBe('query');
		expect(operation.operationName).toBeUndefined();
		expect(operation.query).toBe('{ viewer { id } }');
		expect(operationOf(parse('{ viewer { id } }') as never).kind).toBe('query');
	});

	test('a document holding only a fragment throws', () => {
		const fragment = 'fragment F on User { id }';
		expect(() => operationOf(fragment as never)).toThrow(
			'The document holds no operation',
		);
		expect(() => operationOf(parse(fragment) as never)).toThrow(
			'The document holds no operation',
		);
	});

	test('the same object is read once', () => {
		const node = parse('query A { a }');
		expect(operationOf(node as never)).toBe(operationOf(node as never));
		const typed = new TypedDocumentString('query B { b }');
		expect(operationOf(typed as never)).toBe(operationOf(typed as never));
		expect(operationOf('query C { c }' as never)).toBe(
			operationOf('query C { c }' as never),
		);
	});

	test("the client preset's persisted hash is read from __meta__", () => {
		const node = Object.assign(parse('query H { h }'), {
			__meta__: { hash: 'abc123' },
		});
		expect(operationOf(node as never).hash).toBe('abc123');
		const typed = new TypedDocumentString('query I { i }', { hash: 'def456' });
		expect(operationOf(typed as never).hash).toBe('def456');
		expect(operationOf(parse('query J { j }') as never).hash).toBeUndefined();
	});

	test('a hash-only document holds no operation', () => {
		expect(() => operationOf({ __meta__: { hash: 'abc' } } as never)).toThrow(
			new TypeError('The document holds no operation'),
		);
	});
});
