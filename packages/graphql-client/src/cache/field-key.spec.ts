import { describe, expect, test } from 'bun:test';
import { type FieldNode, type OperationDefinitionNode, parse } from 'graphql';
import { fieldKey, fieldNameOf, stableJson } from './field-key';

function firstField(source: string): FieldNode {
	const operation = parse(source).definitions[0] as OperationDefinitionNode;
	return operation.selectionSet.selections[0] as FieldNode;
}

describe('fieldKey', () => {
	test('a field with no arguments is its name, never its alias', () => {
		expect(fieldKey(firstField('{ mine: viewer { id } }'), {})).toBe('viewer');
	});

	test('arguments are sorted, at every depth', () => {
		const field = firstField(
			'{ books(sort: { by: TITLE, asc: true }, first: 2) { id } }',
		);
		expect(fieldKey(field, {})).toBe(
			'books({"first":2,"sort":{"asc":true,"by":"TITLE"}})',
		);
	});

	test('variables are read, and an argument left unset is left out', () => {
		const field = firstField(
			'query ($id: ID, $q: String) { book(id: $id, q: $q) { id } }',
		);
		expect(fieldKey(field, { id: '1' })).toBe('book({"id":"1"})');
		expect(fieldKey(field, {})).toBe('book');
	});

	test('a literal and a variable of the same value share a key', () => {
		const literal = firstField('{ book(id: "1") { id } }');
		const variable = firstField('query ($id: ID) { book(id: $id) { id } }');
		expect(fieldKey(variable, { id: '1' })).toBe(fieldKey(literal, {}));
	});

	test('fieldNameOf reads the name back', () => {
		expect(fieldNameOf('book({"id":"1"})')).toBe('book');
		expect(fieldNameOf('viewer')).toBe('viewer');
	});

	test('stableJson writes undefined in a list as null', () => {
		expect(stableJson([1, undefined, { b: 1, a: undefined }])).toBe(
			'[1,null,{"b":1}]',
		);
	});

	test('stableJson writes what JSON.stringify writes: toJSON honoured, a Date its ISO string', () => {
		const at = new Date('2026-01-01T00:00:00.000Z');
		expect(stableJson({ b: at, a: [at] })).toBe(
			'{"a":["2026-01-01T00:00:00.000Z"],"b":"2026-01-01T00:00:00.000Z"}',
		);
		expect(stableJson({ a: { toJSON: (key: string) => key } })).toBe(
			'{"a":"a"}',
		);
		expect(stableJson({ a: () => 1, b: { toJSON: () => undefined } })).toBe(
			'{}',
		);
	});

	test('two Date variables are two field keys', () => {
		const field = firstField('query ($at: DateTime) { events(at: $at) }');
		expect(fieldKey(field, { at: new Date(0) })).toBe(
			'events({"at":"1970-01-01T00:00:00.000Z"})',
		);
	});
});
