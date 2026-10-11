import type { FormatSchemas } from '@nxgt/graphql-validation/codegen';
import type { CodegenZodConfig } from './config';
import type { Imports } from './imports';
import { importModule, moduleExport } from './modules';

/** Where one format's schema is imported from, in the generated file. */
interface Source {
	readonly module: string;
	readonly exported: string;
	/** The format's key in a `formatSchemas` record, if it comes from one. */
	readonly key?: string;
}

/** The application's formats as the writer needs them for one file. */
export interface FormatCode {
	/** The record `checkConstraints` and `inputCode` take; none when unset. */
	readonly schemas: FormatSchemas | undefined;
	/** The source of a format's schema, its import added. */
	readonly code: (name: string) => string;
}

/**
 * The application's own formats: `zodFormats` entries, winning over the
 * `formatSchemas` record. Unlike a scalar record, each module is loaded,
 * never trusted: the plugin checks every format, and every default against
 * it, as `withValidation` does, so a module it cannot load fails generation.
 */
export class FormatSources {
	/** The record `checkConstraints` and `inputCode` take; none when unset. */
	readonly schemas: FormatSchemas | undefined;
	readonly #sources: ReadonlyMap<string, Source>;

	private constructor(
		schemas: FormatSchemas | undefined,
		sources: ReadonlyMap<string, Source>,
	) {
		this.schemas = schemas;
		this.#sources = sources;
	}

	static async load(
		config: CodegenZodConfig,
		outputFile: string | undefined,
	): Promise<FormatSources> {
		const schemas: Record<string, unknown> = {};
		const sources = new Map<string, Source>();
		const record = config.formatSchemas;
		if (record) {
			const loaded = (await load('formatSchemas', record, outputFile))[
				'formatSchemas'
			];
			if (
				typeof loaded !== 'object' ||
				loaded === null ||
				Array.isArray(loaded)
			) {
				throw new Error(
					`@nxgt/graphql-codegen-zod: ${record} exports no formatSchemas record.`,
				);
			}
			for (const [key, schema] of Object.entries(loaded)) {
				schemas[key] = schema;
				sources.set(key, { module: record, exported: 'formatSchemas', key });
			}
		}
		for (const [name, value] of Object.entries(config.zodFormats ?? {})) {
			const option = `zodFormats.${name}`;
			const { module, exported } = moduleExport(
				option,
				value,
				'./slug#slugSchema',
			);
			const loaded = await load(option, module, outputFile);
			if (!Object.hasOwn(loaded, exported)) {
				throw new Error(
					`@nxgt/graphql-codegen-zod: ${module} exports no ${exported} (${option}).`,
				);
			}
			schemas[name] = loaded[exported];
			sources.set(name, { module, exported });
		}
		// Each schema is checked by checkConstraints, as withValidation checks it.
		return new FormatSources(
			sources.size > 0 || record ? (schemas as FormatSchemas) : undefined,
			sources,
		);
	}

	/** The formats as written into a file whose imports are `imports`. */
	for(imports: Imports): FormatCode {
		return {
			schemas: this.schemas,
			code: (name) => {
				const source = this.#sources.get(name);
				// inputCode asks only for a format of the record it was given.
				if (!source) throw new Error(`Unknown application format "${name}".`);
				const local = imports.add(source.module, source.exported);
				if (source.key === undefined) return local;
				return /^[a-z][a-z0-9]*$/.test(source.key)
					? `${local}.${source.key}`
					: `${local}[${JSON.stringify(source.key)}]`;
			},
		};
	}
}

/** The module, or an error that says why it could not be loaded and what to do. */
async function load(
	option: string,
	module: string,
	outputFile: string | undefined,
): Promise<Readonly<Record<string, unknown>>> {
	try {
		return await importModule(module, outputFile);
	} catch (error) {
		const cause = error instanceof Error ? error.message : String(error);
		throw new Error(
			`@nxgt/graphql-codegen-zod: cannot load ${module} (${option}): ${cause}. The plugin checks your formats as withValidation does, so it must import them: point ${option} at a module graphql-codegen can load: a path relative to the generated file or a package, in JavaScript, or in TypeScript when codegen runs under Bun or tsx.`,
		);
	}
}
