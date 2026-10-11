import { describe, expect, test } from 'bun:test';
import { Changes, Dependencies } from './changes';

describe('Dependencies.touchedBy', () => {
	const deps = new Dependencies();
	deps.field('Book:1', 'title');
	deps.entity('Book:2');

	test('a changed field the read used', () => {
		const changes = new Changes();
		changes.field('Book:1', 'title');
		expect(deps.touchedBy(changes)).toBe(true);
	});

	test('another field, or another entity, is not', () => {
		const changes = new Changes();
		changes.field('Book:1', 'pages');
		changes.field('Book:3', 'title');
		expect(deps.touchedBy(changes)).toBe(false);
	});

	test('an entity looked up and then created or evicted', () => {
		const changes = new Changes();
		changes.entity('Book:2');
		expect(deps.touchedBy(changes)).toBe(true);
	});

	test('a reset touches everything', () => {
		const changes = new Changes();
		expect(changes.empty).toBe(true);
		changes.everything = true;
		expect(changes.empty).toBe(false);
		expect(new Dependencies().touchedBy(changes)).toBe(true);
	});
});
