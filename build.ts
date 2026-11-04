/**
 * The build for every package in this workspace.
 *
 * Each package runs `bun run ../../build.ts` from its own directory. There is
 * one script rather than one per package because the packages differ only in
 * their entry points, which they declare themselves under `nxgt.entrypoints`.
 *
 * Two outputs, from two tools:
 *
 *   - JavaScript, from `Bun.build` with `packages: 'external'`. A library must
 *     not bundle its dependencies: a package bundling its own copy of
 *     `drizzle-orm` would give an app two `SQL` classes, and an `is()` that
 *     fails for one of them. With `splitting`, what two entry points of one
 *     package share goes to a chunk both import: without it,
 *     `@nxgt/drizzle/pg` would throw its own copy of `NotFoundError`, which
 *     an `instanceof` against the one from `@nxgt/drizzle` rejects.
 *   - Declarations, from `tsc --emitDeclarationOnly` against
 *     `tsconfig.build.json`, which excludes the `*.spec.ts` files that
 *     `tsconfig.json` still typechecks. Their relative imports are then
 *     given the `.js` (or `/index.js`) Node needs: tsc keeps the sources'
 *     extensionless `./scalars`, which a consumer under `nodenext` cannot
 *     resolve, so every name re-exported through it vanishes (TS2305).
 *
 * Hand-written `.d.ts` files are copied, not emitted: tsc passes them through
 * untouched, so an ambient module augmentation would otherwise never reach
 * `dist/`, and what it declares would vanish for every consumer.
 */

import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { $ } from 'bun';
import { declarationSpecifiers } from './scripts/artifacts/declarations';
import { withExtensions } from './scripts/artifacts/dts-imports';

const pkg = await Bun.file('package.json').json();
const name: string = pkg.name;
const entrypoints: string[] = pkg.nxgt?.entrypoints ?? ['src/index.ts'];

// Built over the last build, not after deleting it: an editor's TypeScript
// server that reads `dist/` mid-build then still finds each declaration,
// instead of caching a sibling as a package without types until it restarts.
// What this build did not write is removed at the end.
const written = new Set<string>();

// The moment this build starts, read from the file system's own clock: a file
// in dist/ modified at or after it was written by this build. Linux stamps a
// file with a coarse clock that can lag `Date.now()` by a tick, so the mark is
// a file's mtime rather than the process's time.
await mkdir('dist', { recursive: true });
const startMark = 'dist/.build-start';
await Bun.write(startMark, '');
const buildStart = (await stat(startMark)).mtimeMs;
await rm(startMark);
async function* walk(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else yield full;
	}
}
async function writtenByThisBuild(file: string): Promise<boolean> {
	return (await stat(file)).mtimeMs >= buildStart;
}

const result = await Bun.build({
	entrypoints,
	outdir: 'dist',
	root: 'src',
	target: 'node',
	format: 'esm',
	packages: 'external',
	splitting: true,
	sourcemap: 'linked',
	naming: { entry: '[dir]/[name].[ext]', chunk: 'chunks/[name]-[hash].[ext]' },
});

if (!result.success) {
	console.error(`${name}: build failed`);
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

for (const output of result.outputs) {
	written.add(resolve(output.path));
	written.add(resolve(`${output.path}.map`));
}

const tsc =
	await $`tsc -p tsconfig.build.json --emitDeclarationOnly --listEmittedFiles`
		.quiet()
		.nothrow();
const listed = tsc.stdout.toString();
if (tsc.exitCode !== 0) {
	console.error(`${name}: declarations failed`);
	console.error(listed.replace(/^TSFILE: .*\n/gm, ''), tsc.stderr.toString());
	process.exit(1);
}
// What tsc emitted, read from dist/ as well as from its
// `--listEmittedFiles` output: that output is not always the whole list. Where
// no Node is installed (the oven/bun image) tsc runs on Bun's `node`, and its
// stdout into a pipe can lose its last lines under load, which pruned
// declarations as stale and failed a dependent package with TS7016
// (softistx/nxgt-data#342).
for (const line of listed.split('\n')) {
	if (line.startsWith('TSFILE: ')) written.add(resolve(line.slice(8).trim()));
}
for await (const file of walk('dist')) {
	if (await writtenByThisBuild(file)) written.add(resolve(file));
}
const emitted = new Set(written);

// Node needs the extension tsc leaves off (`withExtensions`).
for (const file of emitted) {
	if (!file.endsWith('.d.ts')) continue;
	const text = await Bun.file(file).text();
	const fixed = withExtensions(text, file, emitted);
	if (fixed.unmatched.length > 0) {
		console.error(
			`${name}: ${file} imports ${fixed.unmatched.join(', ')}, which no emitted declaration matches`,
		);
		process.exit(1);
	}
	if (fixed.text !== text) await Bun.write(file, fixed.text);
	// The scanner verify:artifacts reads imports with, strings and template
	// types handled, is the judge: a relative import it finds without `.js`
	// is one the rewrite missed, and would fail under `nodenext`.
	const missed = declarationSpecifiers(fixed.text).filter(
		(path) => path.startsWith('.') && !/\.[cm]?js$/.test(path),
	);
	if (missed.length > 0) {
		console.error(
			`${name}: ${file} still imports ${missed.join(', ')} without an extension`,
		);
		process.exit(1);
	}
}

// Copy hand-written declarations, preserving their path under src/.
let copied = 0;
for await (const file of walk('src')) {
	if (!file.endsWith('.d.ts')) continue;
	const target = join('dist', relative('src', file));
	// tsc got here first, which means a `.ts` next door has the same basename
	// and this copy would replace that module's real declarations with an
	// ambient file. Refuse rather than silently truncate the public API.
	if (emitted.has(resolve(target))) {
		console.error(
			`${name}: ${file} collides with the declarations tsc emitted for ` +
				`${target}. Rename it, or move it under src/types/.`,
		);
		process.exit(1);
	}
	await $`mkdir -p ${dirname(target)}`.quiet();
	await Bun.write(target, Bun.file(file));
	written.add(resolve(target));
	copied++;
}

// What the last build wrote and this one did not: a module since moved or
// deleted, which would otherwise ship.
let pruned = 0;
for await (const file of walk('dist')) {
	if (written.has(resolve(file))) continue;
	// Belt and braces: whatever the lists above missed, a file this build
	// wrote is never stale.
	if (await writtenByThisBuild(file)) continue;
	await rm(file);
	pruned++;
}
async function removeEmpty(dir: string): Promise<void> {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const inner = join(dir, entry.name);
		await removeEmpty(inner);
		if ((await readdir(inner)).length === 0)
			await rm(inner, { recursive: true });
	}
}
await removeEmpty('dist');

// Every `types` the manifest points at must exist, or the package ships
// without declarations and each consumer fails with TS7016. Fail here, in the
// package that lost them, rather than in the next one to typecheck.
const typesPaths = new Set<string>();
function collectTypes(value: unknown, key?: string): void {
	if (typeof value === 'string') {
		if (key === 'types' || key === 'typings') typesPaths.add(value);
		return;
	}
	if (value === null || typeof value !== 'object') return;
	for (const [k, v] of Object.entries(value)) collectTypes(v, k);
}
collectTypes(pkg.exports);
collectTypes({ types: pkg.types, typings: pkg.typings });
const missingTypes: string[] = [];
for (const path of typesPaths) {
	if (!path.includes('*') && !(await Bun.file(path).exists())) {
		missingTypes.push(path);
	}
}
if (missingTypes.length > 0) {
	console.error(
		`${name}: the manifest's types point at ${missingTypes.join(', ')}, ` +
			'which this build did not leave in dist/.',
	);
	process.exit(1);
}

// A bin runs as a file: it keeps the `#!` line Bun.build carries over from
// its entry, and it must be executable, or `node_modules/.bin/<cmd>` fails.
const bins: Record<string, string> =
	typeof pkg.bin === 'string' ? { [name]: pkg.bin } : (pkg.bin ?? {});
for (const [command, target] of Object.entries(bins)) {
	const file = Bun.file(target);
	if (!(await file.exists()) || !(await file.text()).startsWith('#!')) {
		console.error(
			`${name}: bin ${command} points at ${target}, which is missing or has ` +
				'no #! line. Build it from an entry point that starts with one.',
		);
		process.exit(1);
	}
	await $`chmod 755 ${target}`.quiet();
}

console.log(
	`${name}: ${result.outputs.length} artifact(s)` +
		(copied ? `, ${copied} hand-written declaration(s) copied` : '') +
		(pruned ? `, ${pruned} stale file(s) removed` : ''),
);
