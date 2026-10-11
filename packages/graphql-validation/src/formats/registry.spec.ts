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

describe('registryOf', () => {
	test('builds a registry once per record, and shares the built-in one', () => {
		const own = { siret: z.string() };
		expect(registryOf(own)).toBe(registryOf(own));
		expect(registryOf()).toBe(registryOf());
		expect(registryOf(own)).not.toBe(registryOf());
	});
});
