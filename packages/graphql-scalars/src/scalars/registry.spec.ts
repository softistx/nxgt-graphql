// The guards that let this folder grow to a hundred scalars: each file is
// one scalar, named after it, specced beside it, registered through its
// category's index.ts, and documented. Adding a scalar and forgetting any
// of those fails here, not in a consumer.
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { Glob } from 'bun';
import { GraphQLScalarType } from 'graphql';
import { z } from 'zod';
import { scalarResolvers, schemas } from './index';

const HERE = import.meta.dir;
const GUIDE = join(HERE, '../../docs/guide/scalars.md');

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
	}

	test('nothing is registered that no file holds', () => {
		expect(Object.keys(scalarResolvers)).toHaveLength(files.length);
		expect(Object.keys(schemas)).toHaveLength(files.length);
	});

	test('every scalar is in the scalars guide', async () => {
		const guide = await Bun.file(GUIDE).text();
		const missing = Object.keys(scalarResolvers).filter(
			(name) => !guide.includes(`\`${name}\``),
		);
		expect(missing).toEqual([]);
	});
});
