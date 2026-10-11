import { describe, expect, test } from 'bun:test';
import { parse } from 'graphql';
import {
	cacheDocumentOf,
	collectFields,
	variablesOf,
	type Walk,
} from './selection';
import { typeMatcher } from './type-match';

function walkOf(source: string, variables: Record<string, unknown> = {}): Walk {
	const document = cacheDocumentOf(parse(source));
	return {
		document,
		variables: variablesOf(document.operation, variables),
		matches: typeMatcher(),
	};
}

function keysOf(walk: Walk, typename?: string, undecidedApply = false) {
	const { fields, undecided } = collectFields(
		[walk.document.operation.selectionSet],
		typename,
		walk,
		undecidedApply,
	);
	return { fields: [...fields.keys()], undecided: undecided.length };
}

describe('collectFields', () => {
	test('@skip and @include, from literals and variables', () => {
		const walk = walkOf(
			'query ($a: Boolean!, $b: Boolean!) { x @include(if: $a) y @skip(if: $b) z @include(if: true) @skip(if: false) }',
			{ a: false, b: false },
		);
		expect(keysOf(walk).fields).toEqual(['y', 'z']);
	});

	test('the same response key is grouped, aliases kept apart', () => {
		const walk = walkOf(
			'{ a: book { id } book { title } ...F } fragment F on Query { book { pages } }',
		);
		const { fields } = collectFields(
			[walk.document.operation.selectionSet],
			undefined,
			walk,
			false,
		);
		expect([...fields.keys()]).toEqual(['a', 'book']);
		expect(fields.get('book')).toHaveLength(2);
	});

	test('an undecided fragment is set aside, or joins with undecidedApply', () => {
		const walk = walkOf('{ id ... on Node { name } ... on Book { pages } }');
		expect(keysOf(walk, 'Book')).toEqual({
			fields: ['id', 'pages'],
			undecided: 1,
		});
		expect(keysOf(walk, 'Book', true)).toEqual({
			fields: ['id', 'name', 'pages'],
			undecided: 0,
		});
	});

	test('a spread of an unknown fragment throws', () => {
		expect(() => keysOf(walkOf('{ ...Missing }'))).toThrow(
			'The document has no fragment Missing',
		);
	});
});

describe('cacheDocumentOf and variablesOf', () => {
	test('the root key follows the operation', () => {
		expect(cacheDocumentOf(parse('mutation { a }')).rootKey).toBe(
			'ROOT_MUTATION',
		);
		expect(cacheDocumentOf(parse('{ a }')).rootKey).toBe('ROOT_QUERY');
	});

	test('a document with no operation throws', () => {
		expect(() => cacheDocumentOf(parse('fragment F on A { a }'))).toThrow(
			'The document holds no operation',
		);
	});

	test('a variable left out takes its default', () => {
		const document = cacheDocumentOf(
			parse('query ($n: Int = 2, $q: String) { a(n: $n, q: $q) }'),
		);
		expect(variablesOf(document.operation, { q: 'x' })).toEqual({
			n: 2,
			q: 'x',
		});
		expect(variablesOf(document.operation, { n: 5 })).toEqual({ n: 5 });
	});
});
