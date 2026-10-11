import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { formats } from './index';
import { FormatRegistry, registryOf } from './registry';

const builtInNames = Object.keys(formats).join(', ');

describe('FormatRegistry', () => {
	test('holds the built-in formats with no formats of the application', () => {
		const registry = new FormatRegistry();
		for (const name of Object.keys(formats))
			expect(registry.named(name).name).toBe(name);
	});

	test('adds the application formats beside the built-in ones', () => {
		const siret = z.string().regex(/^\d{14}$/);
		const registry = new FormatRegistry({ siret });
		const schema = registry.named('siret').toZod();
		expect(schema.safeParse('73282932000074').data).toBe('73282932000074');
		expect(schema.safeParse('7328').success).toBe(false);
		expect(registry.named('siret').toCode).toBeUndefined();
		expect(registry.named('email').toCode?.()).toBe('z.email()');
	});

	test('takes a string format and a refined string', () => {
		expect(
			() =>
				new FormatRegistry({
					work: z.email().endsWith('@example.com'),
					even: z.string().refine((value) => value.length % 2 === 0),
				}),
		).not.toThrow();
	});

	test('refuses to replace a built-in format', () => {
		expect(() => new FormatRegistry({ email: z.email() })).toThrow(
			'The format "email" is built in: give yours another name.',
		);
	});

	test.each(['Siret', '1siret', 'si_ret', 'si ret', '', '-siret'])(
		'refuses the name %p',
		(name) => {
			expect(() => new FormatRegistry({ [name]: z.string() })).toThrow(
				`Invalid format name ${JSON.stringify(name)}: write it in lowercase letters, digits and hyphens, starting with a letter.`,
			);
		},
	);

	test.each([
		['a number', z.number()],
		['a transform', z.string().transform((value) => value.trim())],
		['an optional string', z.string().optional()],
		['not a schema', 'z.string()'],
		['null', null],
	])('refuses %s as a format', (_, schema) => {
		expect(
			() => new FormatRegistry({ code: schema as unknown as z.ZodString }),
		).toThrow(
			'The format "code" is not a Zod string schema: write z.string() or a string format such as z.email(), narrowed with .regex() or .refine(), never transformed.',
		);
	});

	test('refuses a string definition zod cannot run, at startup rather than per request', () => {
		const shaped = { _zod: { def: { type: 'string' } } };
		expect(
			() => new FormatRegistry({ code: shaped as unknown as z.ZodString }),
		).toThrow(
			`The format "code" cannot be run: its definition reads type: 'string' but it has no safeParse, safeParseAsync or superRefine, so it is not a schema of zod 4's classic API. Pass the schema z.string() or a string format returns, not an object shaped like one.`,
		);
	});

	test.each([
		['.trim()', z.string().trim()],
		['.toLowerCase()', z.string().toLowerCase()],
		['.toUpperCase()', z.string().toUpperCase()],
		['.normalize()', z.string().normalize()],
		['.overwrite()', z.string().overwrite((value) => value)],
		[
			'a narrowed .trim()',
			z
				.string()
				.regex(/^[a-z]+$/)
				.trim()
				.max(40),
		],
		['a string format with .toLowerCase()', z.email().toLowerCase()],
		['.check(z.trim())', z.string().check(z.trim())],
		['.slugify()', z.string().slugify()],
		['z.url(), which trims', z.url()],
		['z.httpUrl(), which trims', z.httpUrl()],
		['z.url({ normalize: true })', z.url({ normalize: true })],
		['.url() on a string', z.string().max(40).url()],
		['.check(z.url())', z.string().check(z.url())],
		// A type error already (its input is unknown); refused at startup too.
		[
			'z.coerce.string(), which turns 12345 into "12345"',
			z.coerce.string() as unknown as z.ZodString,
		],
	])('refuses a format that rewrites the value: %s', (_, schema) => {
		expect(() => new FormatRegistry({ slug: schema })).toThrow(
			'The format "slug" rewrites the value (.trim(), .toLowerCase(), .toUpperCase(), .normalize(), .slugify(), .overwrite(), z.url(), z.httpUrl() or z.coerce.string()): refuse what is not canonical with .regex() or .refine() instead, so the server and the client check the value as it was sent.',
		);
	});

	test.each([
		['z.email()', z.email()],
		['z.uuid()', z.uuid()],
		['z.iso.datetime()', z.iso.datetime()],
		['z.ipv6()', z.ipv6()],
		['z.base64()', z.base64()],
		['z.jwt()', z.jwt()],
		['z.hostname()', z.hostname()],
		['z.e164()', z.e164()],
		['.lowercase(), which only checks', z.string().lowercase()],
	])('takes %s, which checks and never rewrites', (_, schema) => {
		expect(() => new FormatRegistry({ slug: schema })).not.toThrow();
	});

	test('names every known format, the application ones too, for an unknown one', () => {
		const registry = new FormatRegistry({
			siret: z.string(),
			iban: z.string(),
		});
		expect(() => registry.named('isbn')).toThrow(
			`Unknown @constraint format "isbn". Known formats: ${builtInNames}, siret, iban.`,
		);
	});

	test('finds each of 200 application formats', () => {
		const own = Object.fromEntries(
			Array.from({ length: 200 }, (_, index) => [
				`format-${index}`,
				z.string().length(index + 1),
			]),
		);
		const registry = new FormatRegistry(own);
		for (const [index, name] of Object.keys(own).entries()) {
			const schema = registry.named(name).toZod();
			expect(schema.safeParse('x'.repeat(index + 1)).success).toBe(true);
			expect(schema.safeParse('x'.repeat(index + 2)).success).toBe(false);
		}
		expect(() => registry.named('format-200')).toThrow(
			'Unknown @constraint format "format-200"',
		);
	});
});

describe("an application format's schema", () => {
	test('is narrowed by the rules, and keeps an async check async', async () => {
		const registry = new FormatRegistry({
			free: z.string().refine(async (value) => value !== 'taken'),
		});
		const schema = registry.named('free').toZod().max(5);
		expect((await schema.safeParseAsync('ok')).success).toBe(true);
		expect((await schema.safeParseAsync('taken')).success).toBe(false);
		expect((await schema.safeParseAsync('toolong')).success).toBe(false);
		expect(() => schema.safeParse('ok')).toThrow(
			'Encountered Promise during synchronous parse',
		);
	});
});

describe("an application format's aborting check", () => {
	const code = z
		.string()
		.refine((value) => /^[A-Z]+$/.test(value), {
			message: 'Invalid code: uppercase letters',
			abort: true,
		})
		.min(2);

	test('stops the rules chained after it, as the schema alone does', () => {
		const schema = new FormatRegistry({ code }).named('code').toZod().max(3);
		const alone = code.max(3);
		for (const value of ['abcd1', 'AB', 'ABCDE', 'A']) {
			const issues = schema.safeParse(value).error?.issues;
			expect([value, issues?.map((issue) => issue.message)]).toEqual([
				value,
				alone.safeParse(value).error?.issues.map((issue) => issue.message),
			]);
		}
		expect(schema.safeParse('abcd1').error?.issues).toHaveLength(1);
	});
});

describe('a format that rewrites the value as it runs', () => {
	const rewriting = z.string().check((ctx) => {
		ctx.value = ctx.value.trim();
	});
	const message =
		'The format "padded" rewrote the value it checked: a format checks the value and never changes it, so the server and the client check the value as it was sent. Refuse what is not canonical with .regex() or .refine() instead of setting payload.value in a .check().';

	test('throws, naming the format, rather than pass a rewritten value', () => {
		const schema = new FormatRegistry({ padded: rewriting })
			.named('padded')
			.toZod();
		expect(schema.safeParse('kept').data).toBe('kept');
		expect(() => schema.safeParse(' trimmed ')).toThrow(message);
	});

	test('throws from an async check too', async () => {
		const schema = new FormatRegistry({
			padded: rewriting.refine(async () => true),
		})
			.named('padded')
			.toZod();
		expect((await schema.safeParseAsync('kept')).data).toBe('kept');
		await expect(schema.safeParseAsync(' trimmed ')).rejects.toThrow(message);
	});
});

describe('registryOf', () => {
	test('builds a registry once per record, and shares the built-in one', () => {
		const own = { siret: z.string() };
		expect(registryOf(own)).toBe(registryOf(own));
		expect(registryOf()).toBe(registryOf());
		expect(registryOf(own)).not.toBe(registryOf());
	});
});
