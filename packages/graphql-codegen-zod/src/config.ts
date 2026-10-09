import type { DocumentNode } from 'graphql';
/**
 * The plugin's options, under `config` in `codegen.ts`. The naming options
 * mean what they mean to `@graphql-codegen/typescript`, so the types this
 * plugin writes carry the names the typescript plugins give them.
 */
export interface CodegenZodConfig {
	/**
	 * A module exporting `scalarSchemas`, a record of Zod schemas keyed by
	 * GraphQL scalar name: `'@nxgt/graphql-scalars'`, or a path relative to
	 * the generated file.
	 */
	readonly scalarSchemas?: string;
	/**
	 * One scalar's schema, `'<module>#<export>'`, winning over
	 * `scalarSchemas`: `{ Money: './money#moneySchema' }`.
	 */
	readonly zodScalars?: Readonly<Record<string, string>>;
	/** Before each schema's name: `zSignUpInput`. Default `'z'`. */
	readonly schemaPrefix?: string;
	/**
	 * As the typescript plugins read it, for type names: `'keep'`,
	 * `'change-case-all#<case>'`, a function, or `{ typeNames,
	 * transformUnderscore }`. Default: PascalCase each part between
	 * underscores.
	 */
	readonly namingConvention?:
		| string
		| ((name: string) => string)
		| {
				readonly typeNames?: string | ((name: string) => string);
				readonly enumValues?: unknown;
				readonly transformUnderscore?: boolean;
		  };
	readonly typesPrefix?: string;
	readonly typesSuffix?: string;
	readonly addUnderscoreToArgsType?: boolean;
	readonly dedupeOperationSuffix?: boolean;
	readonly omitOperationSuffix?: boolean;
	/**
	 * The SDL's object types, interfaces and unions, as what a resolver
	 * returns: `zUser`, `User`. Default `true`.
	 */
	readonly objects?: boolean;
	/**
	 * Each named operation's result and each fragment, as the response
	 * holds them: `zUserQuery`, `UserFieldsFragment`. Default `true`.
	 */
	readonly operations?: boolean;
}

/** A file of `documents`, as graphql-codegen hands it to a plugin. */
export interface DocumentFile {
	readonly document?: DocumentNode | undefined;
	readonly location?: string | undefined;
}
