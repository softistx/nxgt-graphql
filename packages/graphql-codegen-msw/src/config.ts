import type { DocumentNode } from 'graphql';

/**
 * The plugin's options, under `config` in `codegen.ts`. The naming options
 * mean what they mean to `@graphql-codegen/typescript-operations` and to
 * `@nxgt/graphql-codegen-zod`: set them once at the root of the codegen
 * config, so the three files name each operation alike.
 */
export interface CodegenMswConfig {
	/**
	 * Where the client sends its operations, as msw's `graphql.link()` takes
	 * it: `'https://api.example.com/graphql'`, or a path msw matches on any
	 * origin, `'*\/graphql'`. Required; each handler's `options.endpoint`
	 * overrides it.
	 */
	readonly endpoint?: string;
	/**
	 * The file `@nxgt/graphql-codegen-zod` writes, as the generated file
	 * imports it: `'./zod'` (relative to the generated file) or a package.
	 * Each handler checks its variables with that file's
	 * `z<Operation>Variables`. Required.
	 */
	readonly schemasImport?: string;
	/**
	 * The module exporting each operation's result and variables types
	 * (`UserQuery`, `UserQueryVariables`): the client preset's `'./graphql'`,
	 * or the file `typescript-operations` writes. Required.
	 */
	readonly typesImport?: string;
	/**
	 * How an invalid input is answered, without calling the resolver:
	 * `'invalid-input'` (the default: one 400 error listing the fields, as
	 * `invalidInputError` builds it), `'bad-user-input'` (the
	 * `BAD_USER_INPUT` error `withValidation` raises, status 200), or
	 * `'<module>#<export>'`, a function of yours typed `InvalidInput`.
	 */
	readonly invalidInput?: string;
	/**
	 * `'<module>#<export>'`, a `Translate` function the default
	 * `invalidInput` words each message with. Without it a message is its
	 * code.
	 */
	readonly translate?: string;
	/** Before each schema's name, as codegen-zod's: `zUserQueryVariables`. Default `'z'`. */
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
	readonly dedupeOperationSuffix?: boolean;
	readonly omitOperationSuffix?: boolean;
}

/** A file of `documents`, as graphql-codegen hands it to a plugin. */
export interface DocumentFile {
	readonly document?: DocumentNode | undefined;
	readonly location?: string | undefined;
}
