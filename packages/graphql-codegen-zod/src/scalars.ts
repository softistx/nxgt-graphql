import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { GraphQLScalarType } from 'graphql';
import type { CodegenZodConfig } from './config';
import type { Imports } from './imports';

/**
 * Where each custom scalar's schema comes from: `scalars` first, then the
 * `scalarSchemas` record. A scalar in neither fails generation, naming it:
 * a scalar written as `z.unknown()` would check nothing, in silence.
 */
export class ScalarSources {
	readonly #config: CodegenZodConfig;
	readonly #imports: Imports;
	/** The record's keys, when its module could be loaded to read them. */
	readonly #recordKeys: ReadonlySet<string> | undefined;

	private constructor(
		config: CodegenZodConfig,
		imports: Imports,
		recordKeys: ReadonlySet<string> | undefined,
	) {
		this.#config = config;
		this.#imports = imports;
		this.#recordKeys = recordKeys;
	}

	/**
	 * Loads the `scalarSchemas` module, if any, to know its keys. One that
	 * cannot be loaded here (a `.ts` file under Node) is trusted: the
	 * generated file then fails to typecheck on a missing key instead.
	 */
	static async load(
		config: CodegenZodConfig,
		imports: Imports,
		outputFile: string | undefined,
	): Promise<ScalarSources> {
		if (!config.scalarSchemas)
			return new ScalarSources(config, imports, undefined);
		const keys = await recordKeys(config.scalarSchemas, outputFile);
		return new ScalarSources(config, imports, keys);
	}

	/** The source of `type`'s schema, its import added. */
	code(type: GraphQLScalarType): string {
		const own = this.#config.scalars?.[type.name];
		if (own !== undefined) {
			const at = own.lastIndexOf('#');
			if (at <= 0 || at === own.length - 1) {
				throw new Error(
					`@nxgt/graphql-codegen-zod: scalars.${type.name} is "${own}"; write it '<module>#<export>', e.g. './money#moneySchema'.`,
				);
			}
			return this.#imports.add(own.slice(0, at), own.slice(at + 1));
		}
		const record = this.#config.scalarSchemas;
		if (record && (!this.#recordKeys || this.#recordKeys.has(type.name))) {
			return `${this.#imports.add(record, 'scalarSchemas')}.${type.name}`;
		}
		const where = record
			? `neither in scalars nor in ${record}'s scalarSchemas`
			: 'not in scalars, and no scalarSchemas is set';
		throw new Error(
			`@nxgt/graphql-codegen-zod: the scalar ${type.name} is ${where}. Map it: scalars: { ${type.name}: './module#export' }, or set scalarSchemas: '@nxgt/graphql-scalars'.`,
		);
	}
}

async function recordKeys(
	module: string,
	outputFile: string | undefined,
): Promise<ReadonlySet<string> | undefined> {
	try {
		const base = module.startsWith('.')
			? resolve(dirname(resolve(outputFile ?? 'index.ts')), module)
			: createRequire(resolve('package.json')).resolve(module);
		const loaded: { scalarSchemas?: unknown } = await import(
			pathToFileURL(base).href
		);
		const record = loaded.scalarSchemas;
		if (typeof record !== 'object' || record === null) {
			throw new Error(
				`@nxgt/graphql-codegen-zod: ${module} exports no scalarSchemas record.`,
			);
		}
		return new Set(Object.keys(record));
	} catch (error) {
		if ((error as Error).message.startsWith('@nxgt/graphql-codegen-zod:'))
			throw error;
		return undefined;
	}
}
