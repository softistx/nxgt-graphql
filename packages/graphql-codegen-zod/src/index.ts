import { checkConstraints } from '@nxgt/graphql-validation/codegen';
import {
	type GraphQLSchema,
	isInputObjectType,
	isInterfaceType,
	isObjectType,
} from 'graphql';
import type { CodegenZodConfig, DocumentFile } from './config';
import { Imports } from './imports';
import { Naming } from './naming';
import { objectBlocks } from './objects-output';
import { ScalarSources } from './scalars';
import { schemaBlocks } from './schema-output';
import { variablesBlocks } from './variables-output';
import { Writer } from './writer';

export type { CodegenZodConfig, DocumentFile } from './config';

/**
 * The graphql-codegen plugin: Zod schemas, and their types, for the
 * schema's enums, input types, field arguments, object types, interfaces and
 * unions, and for the variables of each operation in `documents`, with every `@constraint` of
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
			...(config.objects === false ? [] : objectBlocks(schema, writer, naming)),
			...variablesBlocks(schema, documents, writer, naming),
		];
	};
	// Written twice: the first pass names what the file declares, so the
	// second gives no import one of those names.
	const declarations = (await write(new Imports())).flatMap((block) =>
		[...block.matchAll(/^export (const|type) (\w+)/gm)].map(
			(m) => `${m[1]} ${m[2]}`,
		),
	);
	// A value and a type may share a name; two of one kind may not.
	const twice = declarations.find(
		(declaration, index) => declarations.indexOf(declaration) !== index,
	);
	if (twice)
		throw new Error(
			`@nxgt/graphql-codegen-zod: the file would declare ${twice.split(' ')[1]} twice: two GraphQL names, or a type in a cycle and its Input or Wire type, give the same name. Rename one of the GraphQL types, set typesSuffix, or set objects: false.`,
		);
	const declared = declarations.map(
		(declaration) => declaration.split(' ')[1] ?? '',
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
