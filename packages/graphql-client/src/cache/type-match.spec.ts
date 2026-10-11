import { describe, expect, test } from 'bun:test';
import { typeMatcher } from './type-match';

describe('typeMatcher', () => {
	test('no condition, or no typename to compare, always matches', () => {
		const matches = typeMatcher();
		expect(matches(undefined, 'Book')).toBe(true);
		expect(matches('Book', undefined)).toBe(true);
	});

	test('with possibleTypes, an abstract type matches its members, at any depth', () => {
		const matches = typeMatcher({
			Node: ['Book', 'Author'],
			Searchable: ['Media', 'Author'],
			Media: ['Book', 'Movie'],
		});
		expect(matches('Node', 'Book')).toBe(true);
		expect(matches('Node', 'Movie')).toBe(false);
		expect(matches('Searchable', 'Movie')).toBe(true);
		// Not listed: an object type, which only matches itself.
		expect(matches('Movie', 'Book')).toBe(false);
	});

	test('without possibleTypes, another type is undecided', () => {
		expect(typeMatcher()('Node', 'Book')).toBeUndefined();
		expect(typeMatcher({})('Book', 'Book')).toBe(true);
	});

	test('a cycle in possibleTypes does not loop', () => {
		const matches = typeMatcher({ A: ['B'], B: ['A', 'C'] });
		expect(matches('A', 'C')).toBe(true);
	});
});
