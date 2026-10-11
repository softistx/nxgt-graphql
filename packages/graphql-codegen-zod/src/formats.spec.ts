import { describe, expect, test } from 'bun:test';
import { constraintTypeDefs, withValidation } from '@nxgt/graphql-validation';
import { buildSchema, graphql } from 'graphql';
import { formatSchemas } from '../test/formats';
import * as generatedModule from '../test/generated';
import { skuSchema } from '../test/sku';
import { info } from '../test/write-generated';
import { type CodegenZodConfig, plugin } from './index';

const schemas = generatedModule as unknown as Record<
	string,
	{ safeParse: (value: unknown) => { error?: { issues: Issue[] } } }
>;

interface Issue {
	readonly path: readonly PropertyKey[];
	readonly message: string;
	readonly constraint?: string;
}

const tiny = (fields: string) =>
	buildSchema(`${constraintTypeDefs}\ntype Query { ${fields} }`);

const generate = (fields: string, config: CodegenZodConfig) =>
	plugin(tiny(fields), [], config, info);

describe("the generated file, the application's formats", () => {
	const sdl = `${constraintTypeDefs}
		type Query { a: Int }
		type Mutation {
			order(sku: String! @constraint(format: "sku")): Boolean
			tag(slug: String! @constraint(format: "slug", maxLength: 12), country: String @constraint(format: "country-code")): Boolean
		}`;
	const served = withValidation(buildSchema(sdl), {
		formats: { ...formatSchemas, sku: skuSchema },
	});

	/** The server's first issue, as `extensions.issues` carries it. */
	const serverIssue = async (source: string): Promise<Issue | undefined> => {
		const result = await graphql({ schema: served, source });
		return (
			result.errors?.[0]?.extensions['issues'] as readonly Issue[] | undefined
		)?.[0];
	};

	test("refuses with the server's message and path, the format's own and the rules chained on it", async () => {
		const cases: [string, string, Record<string, unknown>][] = [
			['order(sku: "sku-1")', 'zOrderMutationVariables', { sku: 'sku-1' }],
			[
				'tag(slug: "Al B")',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', handle: 'Al B' } },
			],
			[
				'tag(slug: "a-very-long-one")',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', handle: 'a-very-long-one' } },
			],
			[
				'tag(slug: "al", country: "fr")',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', country: 'fr' } },
			],
		];
		for (const [call, name, variables] of cases) {
			const server = await serverIssue(`mutation { ${call} }`);
			const client = schemas[name]?.safeParse(variables).error?.issues[0];
			expect([call, client?.message]).toEqual([call, server?.message]);
			expect(server?.message).toBeString();
		}
	});

	test('a refusal of the format itself is format’s on the server, whatever its Zod code', async () => {
		expect(
			(await serverIssue('mutation { order(sku: "x") }'))?.constraint,
		).toBe('format');
		// A .refine() inside the format.
		expect(
			(await serverIssue('mutation { tag(slug: "al", country: "fr") }'))
				?.constraint,
		).toBe('format');
		expect(
			(await serverIssue('mutation { tag(slug: "a-very-long-one") }'))
				?.constraint,
		).toBe('maxLength');
	});
});

describe("plugin, the application's formats", () => {
	test('imports the record once, a hyphenated name by its key', async () => {
		const out = await generate(
			'a(s: String @constraint(format: "slug"), c: String @constraint(format: "country-code")): Int',
			{ formatSchemas: './formats' },
		);
		expect(out).toContain('import { formatSchemas } from "./formats";');
		expect(out).toContain('s: formatSchemas.slug.nullish(),');
		expect(out).toContain('c: formatSchemas["country-code"].nullish(),');
	});

	test('takes a zodFormats entry over the record', async () => {
		const out = await generate(
			'a(s: String! @constraint(format: "slug")): Int',
			{
				formatSchemas: './formats',
				zodFormats: { slug: './sku#skuSchema' },
			},
		);
		expect(out).toContain('s: skuSchema,');
		expect(out).not.toContain('formatSchemas');
	});

	test('keeps the built-in formats inline', async () => {
		const out = await generate(
			'a(e: String! @constraint(format: "email")): Int',
			{
				formatSchemas: './formats',
			},
		);
		expect(out).toContain('e: z.email(),');
		expect(out).not.toContain('formatSchemas.');
	});

	test('fails on a format no record or entry names, listing the known ones', async () => {
		await expect(
			generate('a(s: String @constraint(format: "slugg")): Int', {
				formatSchemas: './formats',
			}),
		).rejects.toThrow(
			'Unknown @constraint format "slugg". Known formats: byte, date, date-time, email, ipv4, ipv6, uri, uuid, slug, country-code.',
		);
		await expect(
			generate('a(s: String @constraint(format: "slug")): Int', {}),
		).rejects.toThrow('Unknown @constraint format "slug".');
	});

	test('fails on a default its format refuses, as withValidation does', async () => {
		await expect(
			generate('a(s: String = "Not A Slug" @constraint(format: "slug")): Int', {
				formatSchemas: './formats',
			}),
		).rejects.toThrow(
			'The default value of Query.a(s:) breaks its @constraint',
		);
	});

	test('fails on a zodFormats value that names no export', async () => {
		await expect(
			generate('a: Int', { zodFormats: { slug: './sku' } }),
		).rejects.toThrow(
			`@nxgt/graphql-codegen-zod: zodFormats.slug is "./sku"; write it '<module>#<export>', e.g. './slug#slugSchema'.`,
		);
		await expect(
			generate('a: Int', { zodFormats: { slug: './sku#slugSchema' } }),
		).rejects.toThrow(
			'@nxgt/graphql-codegen-zod: ./sku exports no slugSchema (zodFormats.slug).',
		);
	});

	test('fails on a module it cannot load, rather than trust it', async () => {
		await expect(
			generate('a: Int', { formatSchemas: './nowhere' }),
		).rejects.toThrow(
			'@nxgt/graphql-codegen-zod: cannot load ./nowhere (formatSchemas): ',
		);
		await expect(
			generate('a: Int', { zodFormats: { slug: './nowhere#slugSchema' } }),
		).rejects.toThrow(
			'point zodFormats.slug at a module graphql-codegen can load',
		);
	});

	test('fails on a module that exports no formatSchemas record', async () => {
		await expect(
			generate('a: Int', { formatSchemas: './sku' }),
		).rejects.toThrow(
			'@nxgt/graphql-codegen-zod: ./sku exports no formatSchemas record.',
		);
	});

	test('refuses a format withValidation refuses, with its message', async () => {
		await expect(
			generate('a: Int', { zodFormats: { email: './sku#skuSchema' } }),
		).rejects.toThrow(
			'The format "email" is built in: give yours another name.',
		);
		await expect(
			generate('a: Int', {
				zodFormats: { scalars: './scalars#scalarSchemas' },
			}),
		).rejects.toThrow('The format "scalars" is not a Zod string schema');
		await expect(
			generate('a: Int', { zodFormats: { sku: './sku#trimmedSkuSchema' } }),
		).rejects.toThrow('The format "sku" rewrites the value');
	});

	test.each([
		['z.url()', './sku#linkSchema'],
		['z.coerce.string()', './sku#coercedSkuSchema'],
	])(
		'refuses %s, which rewrites the value, as withValidation does',
		async (_, module) => {
			const fields =
				'a(x: String @constraint(format: "x", maxLength: 14)): Int';
			await expect(
				generate(fields, { zodFormats: { x: module } }),
			).rejects.toThrow(
				'The format "x" rewrites the value (.trim(), .toLowerCase(), .toUpperCase(), .normalize(), .slugify(), .overwrite(), z.url(), z.httpUrl() or z.coerce.string())',
			);
		},
	);
});
