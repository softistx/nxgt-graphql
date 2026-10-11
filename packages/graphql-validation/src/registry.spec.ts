// The guards that let the rules and the formats grow: each file is one rule
// or one format, named after it, specced beside it and registered through
// its folder's all.ts. Forgetting any of those fails here, not in a consumer.
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { Glob } from 'bun';
import { formats } from './formats';
import { rules } from './rules';

/** `minLength` and `date-time` as file names: `min-length`, `date-time`. */
function kebab(name: string): string {
	return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** `date-time` as an export: `dateTime`. */
function camel(name: string): string {
	return name.replace(/-([a-z0-9])/g, (_, letter: string) =>
		letter.toUpperCase(),
	);
}

const folders = [
	{
		folder: 'rules',
		suffix: 'Rule',
		registry: rules,
		key: 'argument',
		helpers: ['rule.ts'],
	},
	{
		folder: 'formats',
		suffix: 'Format',
		registry: formats,
		key: 'name',
		helpers: ['format.ts', 'registry.ts'],
	},
] as const;

for (const { folder, suffix, registry, key, helpers } of folders) {
	const dir = join(import.meta.dir, folder);
	const files = [...new Glob('*.ts').scanSync(dir)]
		.filter((file) => !file.endsWith('.spec.ts'))
		.filter((file) => !['all.ts', 'index.ts', ...helpers].includes(file))
		.sort();

	describe(`every file in ${folder}/`, () => {
		test('there is at least one', () => {
			expect(files.length).toBeGreaterThan(0);
		});

		for (const file of files) {
			test(`${file} exports one ${suffix.toLowerCase()}, named after it, and registered`, async () => {
				const module: Record<string, Record<string, string>> = await import(
					join(dir, file)
				);
				// Nothing else: a helper would reach the registry's namespace.
				const names = Object.keys(module);
				expect(names).toHaveLength(1);
				const [name] = names as [string];
				const entry = module[name] as Record<string, string>;
				const id = entry[key] as string;
				expect(file).toBe(`${kebab(id)}.ts`);
				expect(name).toBe(`${camel(id)}${suffix}`);
				expect((registry as Record<string, unknown>)[id]).toBe(entry);
			});

			test(`${file} has a spec beside it`, async () => {
				expect(
					await Bun.file(join(dir, file.replace(/\.ts$/, '.spec.ts'))).exists(),
				).toBe(true);
			});
		}

		test('nothing is registered that no file holds', () => {
			expect(Object.keys(registry)).toHaveLength(files.length);
		});
	});
}
