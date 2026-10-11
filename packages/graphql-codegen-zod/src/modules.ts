import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Imports a module the config names as the generated file will: a path
 * relative to `outputFile` (`'./formats'`), or a package resolved from the
 * working directory (`'@nxgt/graphql-scalars'`). Throws what resolving or
 * loading throws.
 */
export async function importModule(
	module: string,
	outputFile: string | undefined,
): Promise<Readonly<Record<string, unknown>>> {
	const path = module.startsWith('.')
		? resolve(dirname(resolve(outputFile ?? 'index.ts')), module)
		: createRequire(resolve('package.json')).resolve(module);
	return import(pathToFileURL(path).href);
}

/** `'<module>#<export>'` split in two, or an error naming the option. */
export function moduleExport(
	option: string,
	value: string,
	example: string,
): { readonly module: string; readonly exported: string } {
	const at = value.lastIndexOf('#');
	if (at <= 0 || at === value.length - 1) {
		throw new Error(
			`@nxgt/graphql-codegen-zod: ${option} is "${value}"; write it '<module>#<export>', e.g. '${example}'.`,
		);
	}
	return { module: value.slice(0, at), exported: value.slice(at + 1) };
}
