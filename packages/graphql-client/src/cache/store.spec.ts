import { describe, expect, test } from 'bun:test';
import { EntityStore } from './store';

function filled() {
	const store = new EntityStore();
	store.merge('Book:1', {
		title: 'A',
		'tags({"first":2})': ['x'],
		tags: ['x', 'y'],
	});
	store.takeChanges();
	return store;
}

describe('EntityStore', () => {
	test('merge keeps the other fields and records only what changed', () => {
		const store = filled();
		store.merge('Book:1', { title: 'A', pages: 10 });
		expect(store.get('Book:1')).toEqual({
			title: 'A',
			'tags({"first":2})': ['x'],
			tags: ['x', 'y'],
			pages: 10,
		});
		expect([
			...(store.takeChanges().entities.get('Book:1') as Set<string>),
		]).toEqual(['pages']);
	});

	test('a new entity is a change to the whole entity', () => {
		const store = new EntityStore();
		store.merge('Book:1', { title: 'A' });
		expect(store.takeChanges().entities.get('Book:1')).toBe('all');
	});

	test('modify by name reaches every argument key; undefined removes', () => {
		const store = filled();
		expect(
			store.modify('Book:1', { tags: () => [], title: () => undefined }),
		).toBe(true);
		expect(store.get('Book:1')).toEqual({ 'tags({"first":2})': [], tags: [] });
	});

	test('modify by exact key reaches that key alone, and gets a copy', () => {
		const store = filled();
		store.modify('Book:1', {
			'tags({"first":2})': (current) => {
				(current as string[]).push('mutated in place');
				return ['z'];
			},
		});
		expect(store.get('Book:1')?.['tags({"first":2})']).toEqual(['z']);
		expect(store.get('Book:1')?.['tags']).toEqual(['x', 'y']);
	});

	test('modify and evict on an absent entity return false', () => {
		const store = new EntityStore();
		expect(store.modify('Book:1', { title: () => 'B' })).toBe(false);
		expect(store.evict('Book:1')).toBe(false);
		expect(store.takeChanges().empty).toBe(true);
	});
});
