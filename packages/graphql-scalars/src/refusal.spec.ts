import { expect, test } from 'bun:test';
import { z } from 'zod';
import { refusalExtensions, run } from './refusal';

test('extensions leave out an absent reason', () => {
	expect(refusalExtensions('Slug')).toEqual({
		code: 'INVALID_SCALAR',
		scalar: 'Slug',
	});
	expect(refusalExtensions('Slug', 'too_small')).toEqual({
		code: 'INVALID_SCALAR',
		scalar: 'Slug',
		reason: 'too_small',
	});
});

test('only an input refusal carries them', () => {
	const attempt = () => z.safeParse(z.string(), 1);
	for (const input of [true, false]) {
		try {
			run('Slug', 'represent this input', attempt, { input });
		} catch (error) {
			const { extensions } = error as { extensions: object };
			expect(Object.keys(extensions).length > 0).toBe(input);
		}
	}
});
