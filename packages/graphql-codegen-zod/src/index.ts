import { checkConstraints } from '@nxgt/graphql-validation/codegen';
import {
	type DocumentNode,
	type GraphQLSchema,
	isInputObjectType,
	isInterfaceType,
	isObjectType,
} from 'graphql';
import type { CodegenZodConfig } from './config';
import { Imports } from './imports';
import { Naming } from './naming';
import { ScalarSources } from './scalars';
import { schemaBlocks } from './schema-output';
import { variablesBlocks } from './variables-output';
import { Writer } from './writer';

export type { CodegenZodConfig } from './config';

/** A file of `documents`, as graphql-codegen hands it to a plugin. */
export interface DocumentFile {
	readonly document?: DocumentNode | undefined;
	readonly location?: string | undefined;
}

/**
 * The graphql-codegen plugin: Zod schemas, and their types, for the
 * schema's enums, input types and field arguments, and for the variables of
 * each operation in `documents`, with every `@constraint` of
 * `@nxgt/graphql-validation`. It refuses a schema `withValidation` would
 * refuse, with the same message.
 */
export async function plugin(
	schema: GraphQLSchema,
	documents: readonly DocumentFile[],
	config: CodegenZodConfig = {},
	info?: { readonly outputFile?: string | undefined },
): Promise<string> {
	const directive = checkConstraints(schema);
	if (directive) assertSdl(schema);
	const naming = new Naming(config);
	const write = async (imports: Imports) => {
		const scalars = await ScalarSources.load(config, imports, info?.outputFile);
		const writer = new Writer(directive, naming, scalars);
		return [
			...schemaBlocks(schema, writer, naming),
			...variablesBlocks(schema, documents, writer, naming),
		];
	};
	// Written twice: the first pass names what the file declares, so the
	// second gives no import one of those names.
	const declared = (await write(new Imports())).flatMap((block) =>
		[...block.matchAll(/^export (?:const|type) (\w+)/gm)].map(
			(m) => m[1] ?? '',
		),
	);
	const imports = new Imports(declared);
	const blocks = await write(imports);
	return `${imports.lines().join('\n')}\n\n${blocks.join('\n\n')}\n`;
}

/**
 * Fails on a schema that declares `@constraint` but was built without its
 * SDL (introspected, loaded from a URL): its arguments carry no directives
 * to read, and every constraint would be dropped in silence.
 */
function assertSdl(schema: GraphQLSchema): void {
	for (const type of Object.values(schema.getTypeMap())) {
		if (type.name.startsWith('__')) continue;
		const inputs = isInputObjectType(type)
			? Object.values(type.getFields())
			: isObjectType(type) || isInterfaceType(type)
				? Object.values(type.getFields()).flatMap((field) => field.args)
				: [];
		const bare = inputs.find((input) => !input.astNode);
		if (bare) {
			throw new Error(
				`@nxgt/graphql-codegen-zod: the schema declares @constraint, but ${type.name} has no SDL to read it from (an introspected schema?). Point codegen's schema at the SDL files.`,
			);
		}
	}
}
