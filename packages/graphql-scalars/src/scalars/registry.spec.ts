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

/** `DateTime` → `date-time`, `URL` → `url`, `NonEmptyString` → `non-empty-string`. */
function kebab(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
		.toLowerCase();
}

/** `date-time` → `dateTime`. */
function camel(file: string): string {
	return file.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
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
			const scalars = Object.entries(module).filter(
				([, value]) => value instanceof GraphQLScalarType,
			);
			const zods = Object.entries(module).filter(
				([, value]) => value instanceof z.ZodType,
			);
			expect(scalars).toHaveLength(1);
			expect(zods).toHaveLength(1);
			const [[exportName, scalar]] = scalars as [[string, GraphQLScalarType]];
			expect(kebab(scalar.name)).toBe(base);
			expect(exportName).toBe(`${scalar.name}Scalar`);
			expect(zods[0]?.[0]).toBe(`${camel(base)}Schema`);
		});

		test(`${file} is registered through its category's index.ts`, async () => {
			const module: Record<string, unknown> = await import(join(HERE, file));
			const scalar = Object.values(module).find(
				(value) => value instanceof GraphQLScalarType,
			) as GraphQLScalarType;
			const registered: Record<string, unknown> = scalarResolvers;
			expect(registered[scalar.name]).toBe(scalar);
			const known: Record<string, unknown> = schemas;
			expect(known[camel(base)]).toBe(module[`${camel(base)}Schema`]);
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
