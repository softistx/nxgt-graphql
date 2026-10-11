import { describe, expect, test } from 'bun:test';
import { buildSchema, type GraphQLObjectType, graphql } from 'graphql';
import { z } from 'zod';
import { constraintTypeDefs } from './constraint-directive';
import { withValidation } from './with-validation';

// An application's formats module, as the README writes it.
const formatSchemas = {
	siret: z
		.string()
		.refine(
			(value) => /^\d{14}$/.test(value),
			'Invalid SIRET: write its 14 digits',
		),
	'work-email': z.email().endsWith('@example.com'),
};

const sdl = `${constraintTypeDefs}
	input Company {
		siret: String! @constraint(format: "siret")
		contact: String @constraint(format: "work-email", maxLength: 20)
	}
	type Query { company(input: Company!): String }`;

/** A server over `sdl` whose resolver records the arguments it receives. */
function server(formats = formatSchemas) {
	const schema = buildSchema(sdl);
	const seen: unknown[] = [];
	const company = (schema.getQueryType() as GraphQLObjectType).getFields()[
		'company'
	] as { resolve?: unknown };
	company.resolve = (_: unknown, args: unknown) => {
		seen.push(args);
		return 'ok';
	};
	return { schema: withValidation(schema, { formats }), seen };
}

interface Issue {
	path: string[];
	code: string;
	constraint?: string;
	message: string;
}

const issuesOf = (result: Awaited<ReturnType<typeof graphql>>) =>
	result.errors?.[0]?.extensions['issues'] as Issue[] | undefined;

describe('withValidation with formats of the application', () => {
	test('lets a value its format accepts through, as it was sent', async () => {
		const { schema, seen } = server();
		const result = await graphql({
			schema,
			source:
				'{ company(input: { siret: "73282932000074", contact: "ada@example.com" }) }',
		});
		expect(result.errors).toBeUndefined();
		expect(seen).toEqual([
			{ input: { siret: '73282932000074', contact: 'ada@example.com' } },
		]);
	});

	test("refuses a value its format refuses, with the format's message, named format", async () => {
		const { schema, seen } = server();
		const result = await graphql({
			schema,
			source: '{ company(input: { siret: "7328" }) }',
		});
		expect(seen).toEqual([]);
		expect(result.errors?.[0]?.extensions['code']).toBe('BAD_USER_INPUT');
		expect(issuesOf(result)).toEqual([
			{
				path: ['input', 'siret'],
				code: 'custom',
				constraint: 'format',
				message: 'Invalid SIRET: write its 14 digits',
			},
		]);
	});

	test('narrows a format of the application with the rules written after it', async () => {
		const { schema } = server();
		const tooLong = await graphql({
			schema,
			source:
				'{ company(input: { siret: "73282932000074", contact: "ada.lovelace@example.com" }) }',
		});
		expect(issuesOf(tooLong)?.map(({ constraint }) => constraint)).toEqual([
			'maxLength',
		]);
		const elsewhere = await graphql({
			schema,
			source:
				'{ company(input: { siret: "73282932000074", contact: "ada@ex.co" }) }',
		});
		// The format's own .endsWith(), not the endsWith rule.
		expect(issuesOf(elsewhere)?.map(({ constraint }) => constraint)).toEqual([
			'format',
		]);
	});

	test('keeps the built-in formats', () => {
		const schema = buildSchema(`${constraintTypeDefs}
			type Query { a(email: String @constraint(format: "email"), siret: String @constraint(format: "siret")): Int }`);
		expect(() =>
			withValidation(schema, { formats: formatSchemas }),
		).not.toThrow();
	});

	test('wraps again with the same formats as a no-op', () => {
		const { schema } = server();
		expect(() =>
			withValidation(schema, { formats: { ...formatSchemas } }),
		).not.toThrow();
	});

	describe('fails at startup', () => {
		test('when wrapped again with other formats', () => {
			const { schema } = server();
			const message =
				'withValidation: this schema is already wrapped with other formats. Call withValidation once, with every format.';
			expect(() =>
				withValidation(schema, {
					formats: { ...formatSchemas, iban: z.string() },
				}),
			).toThrow(message);
			expect(() => withValidation(schema)).toThrow(message);
			expect(() =>
				withValidation(schema, {
					formats: { ...formatSchemas, siret: z.string() },
				}),
			).toThrow(message);
		});

		test('when wrapped with formats after a wrap without', () => {
			const schema = withValidation(
				buildSchema(
					`${constraintTypeDefs} type Query { a(n: Int @constraint(min: 1)): Int }`,
				),
			);
			expect(() =>
				withValidation(schema, { formats: { siret: z.string() } }),
			).toThrow('already wrapped with other formats');
		});

		test('on a format the SDL names and nobody declared, listing the application ones', () => {
			const schema = buildSchema(`${constraintTypeDefs}
				type Query { a(code: String @constraint(format: "isbn")): Int }`);
			expect(() => withValidation(schema, { formats: formatSchemas })).toThrow(
				'Unknown @constraint format "isbn". Known formats: byte, date, date-time, email, ipv4, ipv6, uri, uuid, siret, work-email.',
			);
		});

		test('on a bad name, a built-in name, or a schema that is not a string', () => {
			const schema = () =>
				buildSchema(`${constraintTypeDefs} type Query { a: Int }`);
			const loose = (formats: Record<string, unknown>) =>
				withValidation(schema(), { formats: formats as never });
			expect(() => loose({ Siret: z.string() })).toThrow(
				'Invalid format name "Siret"',
			);
			expect(() => loose({ uuid: z.uuid() })).toThrow(
				'The format "uuid" is built in: give yours another name.',
			);
			expect(() => loose({ code: z.string().transform(Number) })).toThrow(
				'The format "code" is not a Zod string schema',
			);
		});
	});
});

// Never called: what tsc says about each line is the test.
export function typeLevel(schema: ReturnType<typeof buildSchema>) {
	withValidation(schema, { formats: { siret: z.string() } });
	withValidation(schema, { formats: { iban: z.string().regex(/^[A-Z]/) } });
	withValidation(schema, { formats: { 'work-email': z.email() } });
	// @ts-expect-error a built-in format's name is `never`
	withValidation(schema, { formats: { email: z.email() } });
	// @ts-expect-error a format is a string schema
	withValidation(schema, { formats: { age: z.number() } });
	// @ts-expect-error a transform is no string schema
	withValidation(schema, { formats: { trim: z.string().transform(Number) } });
	const formats = { uuid: z.uuid(), siret: z.string() };
	// @ts-expect-error a built-in name in a record declared apart, too
	withValidation(schema, { formats });
}
