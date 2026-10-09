import { dirname, join, resolve } from 'node:path';

/**
 * A relative specifier in a declaration, quoted, after what introduces it:
 * `from './x'`, `import './x'`, `import('./x')`, `declare module './x'`,
 * `'.'` and `'..'` included.
 */
const RELATIVE =
	/(\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\bdeclare\s+module\s+)(['"])(\.\.?(?:\/[^'"]*)?)\2/g;

/**
 * `text`, a declaration `file` tsc emitted, with each relative import given
 * the extension Node needs: `./x.js` when `./x.d.ts` was emitted, else
 * `./x/index.js` when `./x/index.d.ts` was. tsc keeps the sources'
 * extensionless `./x`, which `bundler` resolves and `nodenext` does not. A
 * specifier already ending in `.js`, `.mjs` or `.cjs` is left; one no
 * emitted declaration matches is returned in `unmatched`. Pure, so it has
 * specs.
 */
export function withExtensions(
	text: string,
	file: string,
	emitted: ReadonlySet<string>,
): { readonly text: string; readonly unmatched: string[] } {
	const unmatched: string[] = [];
	const fixed = text.replace(
		RELATIVE,
		(all, lead: string, quote: string, path: string) => {
			if (/\.[cm]?js$/.test(path)) return all;
			const base = resolve(dirname(file), path);
			const folder = path.replace(/\/$/, '');
			const js = emitted.has(`${base}.d.ts`)
				? `${path}.js`
				: emitted.has(join(base, 'index.d.ts'))
					? `${folder}/index.js`
					: undefined;
			if (!js) {
				unmatched.push(path);
				return all;
			}
			return `${lead}${quote}${js}${quote}`;
		},
	);
	return { text: fixed, unmatched };
}
