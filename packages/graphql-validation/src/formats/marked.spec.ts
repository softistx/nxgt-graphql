// A format runs through zod's public API only: these specs run the format
// matrix (sync, async, abort, rewriting, a default value) with zod's
// internals gone or changed, as a later zod 4 release may change them.
import { describe, expect, test } from 'bun:test';
import { buildSchema, type GraphQLObjectType, graphql } from 'graphql';
import { z } from 'zod';
import { publicOnly } from '../../test/public-only';
import { constraintTypeDefs } from '../constraint-directive';
import { withValidation } from '../with-validation';
import type { StringSchema } from './format';
import { FormatRegistry } from './registry';

const changed = () => {
	throw new Error('zod internals changed');
};

const internals = [
	['as zod 4.6 builds it', <S extends StringSchema>(schema: S) => schema],
	[
		'with no _zod.run',
		<S extends StringSchema>(schema: S) => publicOnly(schema),
	],
	[
		'with a _zod.run that throws',
		<S extends StringSchema>(schema: S) => publicOnly(schema, changed),
	],
] as const;

interface Issue {
	path: string[];
	code: string;
	constraint?: string;
	message: string;
}

/** A server whose `a(s:)` takes `format: "f"` then `maxLength: 3`. */
function server(
	f: StringSchema,
	sdl = 'a(s: String @constraint(format: "f", maxLength: 3)): String',
) {
	const schema = buildSchema(`${constraintTypeDefs} type Query { ${sdl} }`);
	const seen: unknown[] = [];
	const field = (schema.getQueryType() as GraphQLObjectType).getFields()[
		'a'
	] as { resolve?: unknown };
	field.resolve = (_: unknown, { s }: { s: string }) => {
		seen.push(s);
		return s;
	};
	const validated = withValidation(schema, { formats: { f } });
	const ask = async (value: string) => {
		const result = await graphql({
			schema: validated,
			source: `{ a(s: ${JSON.stringify(value)}) }`,
		});
		return {
			result,
			issues: result.errors?.[0]?.extensions['issues'] as Issue[] | undefined,
		};
	};
	return { ask, seen };
}

async function noUnhandledRejection(run: () => unknown): Promise<unknown[]> {
	const rejections: unknown[] = [];
	const record = (reason: unknown) => rejections.push(reason);
	process.on('unhandledRejection', record);
	try {
		await run();
		await new Promise((resolve) => setTimeout(resolve, 10));
	} finally {
		process.off('unhandledRejection', record);
	}
	return rejections;
}

for (const [label, wrap] of internals) {
	describe(`an application format ${label}`, () => {
		test('accepts what its checks accept, as sent, and refuses the rest as format’s', async () => {
			const { ask, seen } = server(
				wrap(z.string().regex(/^[a-z]+$/, 'Invalid code: lowercase letters')),
			);
			expect((await ask('abc')).result).toEqual({ data: { a: 'abc' } });
			expect(seen).toEqual(['abc']);
			expect((await ask('A1')).issues).toEqual([
				{
					path: ['s'],
					code: 'invalid_format',
					constraint: 'format',
					message: 'Invalid code: lowercase letters',
				},
			]);
		});

		test('lets the rules after it narrow it, and keeps a string format’s own check', async () => {
			const { ask } = server(wrap(z.email()));
			expect((await ask('a@b.co')).issues?.map((i) => i.constraint)).toEqual([
				'maxLength',
			]);
			expect((await ask('no')).issues?.map((i) => i.constraint)).toEqual([
				'format',
			]);
		});

		test('stops the rules after it on an aborting check, as the schema alone does', async () => {
			const code = z
				.string()
				.refine((value) => /^[A-Z]+$/.test(value), {
					message: 'Invalid code: uppercase letters',
					abort: true,
				})
				.min(2);
			const { ask } = server(wrap(code));
			for (const value of ['abcd1', 'AB', 'ABCDE', 'A']) {
				expect([
					value,
					(await ask(value)).issues?.map((issue) => issue.message),
				]).toEqual([
					value,
					code
						.max(3)
						.safeParse(value)
						.error?.issues.map((i) => i.message),
				]);
			}
		});

		test('runs an async check once per value, and refuses as it says', async () => {
			let calls = 0;
			const { ask } = server(
				wrap(
					z.string().refine(async (value) => {
						calls++;
						return value !== 'bad';
					}, 'taken'),
				),
			);
			expect((await ask('ok')).result).toEqual({ data: { a: 'ok' } });
			expect(calls).toBe(1);
			expect((await ask('bad')).issues).toEqual([
				{ path: ['s'], code: 'custom', constraint: 'format', message: 'taken' },
			]);
			expect(calls).toBe(2);
		});

		test('fails the operation with the error an async check rejects with, nothing unhandled', async () => {
			const { ask, seen } = server(
				wrap(
					z.string().refine(async () => {
						throw new Error('db down');
					}),
				),
			);
			let message: string | undefined;
			await expect(
				noUnhandledRejection(async () => {
					message = (await ask('a')).result.errors?.[0]?.message;
				}),
			).resolves.toEqual([]);
			expect(message).toBe('db down');
			expect(seen).toEqual([]);
		});

		test('fails the operation, naming the format, when a check rewrites the value', async () => {
			const trimming = z.string().check((ctx) => {
				ctx.value = ctx.value.trim();
			});
			for (const f of [trimming, trimming.refine(async () => true)]) {
				const { ask, seen } = server(wrap(f));
				expect((await ask('ok')).result).toEqual({ data: { a: 'ok' } });
				const { result } = await ask(' x ');
				expect(result.errors?.[0]?.message).toStartWith(
					'The format "f" rewrote the value it checked',
				);
				expect(seen).toEqual(['ok']);
			}
		});

		test('fails startup on a default value an async format would check, nothing unhandled', async () => {
			const f = wrap(
				z.string().refine(async () => {
					throw new Error('db down');
				}),
			);
			await expect(
				noUnhandledRejection(() =>
					expect(() =>
						server(f, 'a(s: String = "x" @constraint(format: "f")): String'),
					).toThrow(
						'The default value of Query.a(s:) cannot be checked at startup: the format "f" checks asynchronously',
					),
				),
			).resolves.toEqual([]);
		});
	});
}

describe('an async check the definition does not show', () => {
	// An async .superRefine(): its definition holds zod's wrapper, no async
	// function, so the format learns it from the first value.
	const counted = () => {
		const calls = { n: 0 };
		const f = z.string().superRefine(async (value, ctx) => {
			calls.n++;
			if (value === 'bad') ctx.addIssue({ code: 'custom', message: 'taken' });
		});
		return { f, calls };
	};

	test('runs twice for the first value, then once per value', async () => {
		const { f, calls } = counted();
		const { ask } = server(f);
		expect((await ask('ok')).result).toEqual({ data: { a: 'ok' } });
		expect(calls.n).toBe(2);
		expect((await ask('bad')).issues).toEqual([
			{ path: ['s'], code: 'custom', constraint: 'format', message: 'taken' },
		]);
		expect(calls.n).toBe(3);
	});

	test('is told apart from a check that throws, which fails the operation', async () => {
		const f = z.string().refine(() => {
			throw new Error('boom');
		});
		const { ask } = server(f);
		expect((await ask('a')).result.errors?.[0]?.message).toBe('boom');
		expect((await ask('b')).result.errors?.[0]?.message).toBe('boom');
	});
});

describe('the registry', () => {
	test('takes a schema whose internals changed, as long as its public API is there', () => {
		expect(
			() =>
				new FormatRegistry({
					a: publicOnly(z.string()),
					b: publicOnly(z.email(), changed),
				}),
		).not.toThrow();
	});
});
