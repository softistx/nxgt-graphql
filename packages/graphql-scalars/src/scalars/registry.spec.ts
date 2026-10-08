// The guards that let this folder grow to a hundred scalars: each file is
// one scalar, named after it, specced beside it (an integer one through
// integerCases), registered through its category's index.ts, and documented. Adding a scalar and forgetting any
// of those fails here, not in a consumer.
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { Glob } from 'bun';
import { GraphQLScalarType } from 'graphql';
import { z } from 'zod';
import { scalarResolvers, schemas } from './index';

const HERE = import.meta.dir;
const GUIDES = join(HERE, '../../docs/guide/scalars');

/** The letters of a name, case and hyphens aside: `IPv4` and `ipv4` match. */
function letters(name: string): string {
	return name.replaceAll('-', '').toLowerCase();
}

/** The one scalar and the one schema a scalar file exports. */
function exportsOf(module: Record<string, unknown>) {
	const scalars = Object.entries(module).filter(
		([, value]) => value instanceof GraphQLScalarType,
	) as [string, GraphQLScalarType][];
	const zods = Object.entries(module).filter(
		([, value]) => value instanceof z.ZodType,
	);
	return { scalars, zods };
}

const files = [...new Glob('*/*.ts').scanSync(HERE)]
	.filter((file) => !file.endsWith('.spec.ts') && !file.endsWith('/index.ts'))
	.sort();

describe('every scalar file', () => {
	test('there is at least one', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	for (const file of files) {
		const base = file.slice(file.indexOf('/') + 1, -'.ts'.length);

		test(`${file} exports one scalar and its schema, named after it`, async () => {
			const module: Record<string, unknown> = await import(join(HERE, file));
			const { scalars, zods } = exportsOf(module);
			expect(scalars).toHaveLength(1);
			expect(zods).toHaveLength(1);
			const [[scalarExport, scalar]] = scalars as [[string, GraphQLScalarType]];
			const [[schemaExport]] = zods as [[string, unknown]];
			// Nothing else: `export *` would lift it to the package root.
			expect(Object.keys(module).sort()).toEqual(
				[scalarExport, schemaExport].sort(),
			);
			// `ipv4.ts` holds `IPv4`, `date-time.ts` holds `DateTime`.
			expect(base).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(letters(base)).toBe(letters(scalar.name));
			expect(scalarExport).toBe(`${scalar.name}Scalar`);
			expect(schemaExport).toMatch(/^[a-z][A-Za-z0-9]*Schema$/);
			expect(letters(schemaExport)).toBe(`${letters(base)}schema`);
		});

		test(`${file} is registered through its category's index.ts`, async () => {
			const module: Record<string, unknown> = await import(join(HERE, file));
			const { scalars, zods } = exportsOf(module);
			const [[, scalar]] = scalars as [[string, GraphQLScalarType]];
			const [[schemaExport, schema]] = zods as [[string, unknown]];
			const registered: Record<string, unknown> = scalarResolvers;
			expect(registered[scalar.name]).toBe(scalar);
			const known: Record<string, unknown> = schemas;
			expect(known[schemaExport.replace(/Schema$/, '')]).toBe(schema);
		});

		test(`${file} has a spec beside it`, async () => {
			const spec = join(HERE, file.replace(/\.ts$/, '.spec.ts'));
			expect(await Bun.file(spec).exists()).toBe(true);
		});

		test(`${file}, if an integer scalar, runs integerCases`, async () => {
			const source = await Bun.file(join(HERE, file)).text();
			if (!source.includes("literals: 'integer'")) return;
			const spec = join(HERE, file.replace(/\.ts$/, '.spec.ts'));
			expect(await Bun.file(spec).text()).toContain('integerCases(');
		});
	}

	test('nothing is registered that no file holds', () => {
		expect(Object.keys(scalarResolvers)).toHaveLength(files.length);
		expect(Object.keys(schemas)).toHaveLength(files.length);
	});

	test('every category has its guide page, and no page is left over', () => {
		const categories = [
			...new Set(files.map((file) => file.slice(0, file.indexOf('/')))),
		];
		const pages = [...new Glob('*.md').scanSync(GUIDES)].map((page) =>
			page.slice(0, -'.md'.length),
		);
		expect(pages.sort()).toEqual(categories.sort());
	});

	test("every scalar has a section in its category's guide page", async () => {
		const missing: string[] = [];
		for (const file of files) {
			const [category] = file.split('/');
			const module: Record<string, unknown> = await import(join(HERE, file));
			const { scalars } = exportsOf(module);
			const [[, scalar]] = scalars as [[string, GraphQLScalarType]];
			const page = await Bun.file(join(GUIDES, `${category}.md`)).text();
			if (!page.split('\n').includes(`## \`${scalar.name}\``)) {
				missing.push(`${scalar.name} in docs/guide/scalars/${category}.md`);
			}
		}
		expect(missing).toEqual([]);
	});
});
