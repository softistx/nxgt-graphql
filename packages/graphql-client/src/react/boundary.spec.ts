import { describe, expect, test } from 'bun:test';
import { dirname, join, relative } from 'node:path';

const src = join(import.meta.dir, '..');
const transpiler = new Bun.Transpiler({ loader: 'ts' });

/** Every module `entry` loads, relative to src/, and every package it names. */
async function graphOf(entry: string) {
	const modules = new Set<string>();
	const packages = new Set<string>();
	const visit = async (file: string): Promise<void> => {
		const rel = relative(src, file);
		if (modules.has(rel)) return;
		modules.add(rel);
		const code = await Bun.file(file).text();
		for (const { path, kind } of transpiler.scanImports(code)) {
			if (kind !== 'import-statement' && kind !== 'dynamic-import') continue;
			if (!path.startsWith('.')) {
				packages.add(path);
				continue;
			}
			const base = join(dirname(file), path);
			const found = [`${base}.ts`, join(base, 'index.ts')].find(
				(candidate) => Bun.file(candidate).size > 0,
			);
			if (!found) throw new Error(`${rel} imports ${path}, which is no module`);
			await visit(found);
		}
	};
	await visit(join(src, entry));
	return { modules: [...modules], packages: [...packages] };
}

describe('the root entry and the react subpath', () => {
	test('the root never loads react, nor a module of src/react/', async () => {
		const { modules, packages } = await graphOf('index.ts');
		expect(packages.filter((name) => /^react(-dom)?(\/|$)/.test(name))).toEqual(
			[],
		);
		expect(modules.filter((module) => module.startsWith('react/'))).toEqual([]);
		expect(modules).toContain('client.ts');
	});

	test('the react subpath names react, and nothing it does not declare', async () => {
		const { packages } = await graphOf('react/index.ts');
		const manifest = await Bun.file(join(src, '..', 'package.json')).json();
		const declared = Object.keys({
			...manifest.dependencies,
			...manifest.peerDependencies,
		});
		expect(packages).toContain('react');
		for (const name of packages)
			expect(
				declared.some((dep) => name === dep || name.startsWith(`${dep}/`)),
			).toBe(true);
	});
});
