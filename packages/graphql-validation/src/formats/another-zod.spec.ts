import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildSchema, type GraphQLObjectType, graphql } from 'graphql';
import { z } from 'zod';
import { constraintTypeDefs } from '../constraint-directive';
import { withValidation } from '../with-validation';
import { FormatRegistry } from './registry';

// A second copy of zod, as an application with its own install has: the
// package's files copied elsewhere load as other modules, other classes.
let copy: string;
let other: typeof z;

beforeAll(async () => {
	copy = mkdtempSync(join(tmpdir(), 'nxgt-graphql-zod-'));
	const installed = dirname(
		Bun.resolveSync('zod/package.json', import.meta.dir),
	);
	cpSync(installed, join(copy, 'zod'), {
		recursive: true,
		filter: (path) => !path.includes('/src/'),
	});
	other = (
		(await import(join(copy, 'zod', 'index.js'))) as typeof import('zod')
	).z;
});

afterAll(() => rmSync(copy, { recursive: true, force: true }));

describe('a format with an async check, from another zod copy', () => {
	test('is another copy indeed', () => {
		expect(other).not.toBe(z);
		expect(other.core.$ZodAsyncError).not.toBe(z.core.$ZodAsyncError);
	});

	test('accepts and refuses as the same format from the package zod', async () => {
		const free = (zod: typeof z) =>
			new FormatRegistry({
				free: zod.string().refine(async (value) => value !== 'taken', 'taken'),
			})
				.named('free')
				.toZod();
		for (const value of ['ok', 'taken']) {
			const theirs = await free(other).safeParseAsync(value);
			const ours = await free(z).safeParseAsync(value);
			expect(theirs.success).toBe(ours.success);
			expect(theirs.error?.issues).toEqual(ours.error?.issues);
		}
		expect(() => free(other).safeParse('ok')).toThrow(
			'Encountered Promise during synchronous parse',
		);
	});

	test('passes a request its check accepts, refuses one it refuses', async () => {
		const schema = buildSchema(`${constraintTypeDefs}
			type Query { a(s: String @constraint(format: "free")): String }`);
		const field = (schema.getQueryType() as GraphQLObjectType).getFields()[
			'a'
		] as { resolve?: unknown };
		field.resolve = (_: unknown, { s }: { s: string }) => s;
		const validated = withValidation(schema, {
			formats: {
				free: other
					.string()
					.refine(async (value) => value !== 'taken', 'taken'),
			},
		});
		const ok = await graphql({ schema: validated, source: '{ a(s: "ok") }' });
		expect(ok).toEqual({ data: { a: 'ok' } });
		const refused = await graphql({
			schema: validated,
			source: '{ a(s: "taken") }',
		});
		expect(refused.errors?.[0]?.extensions['code']).toBe('BAD_USER_INPUT');
		expect(refused.errors?.[0]?.extensions['issues']).toEqual([
			{ path: ['s'], code: 'custom', constraint: 'format', message: 'taken' },
		]);
	});
});
