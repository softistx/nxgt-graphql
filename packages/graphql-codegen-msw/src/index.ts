import type { GraphQLSchema } from 'graphql';
import type { CodegenMswConfig, DocumentFile } from './config';
import { Imports } from './imports';
import { inputTypesCode, variableTypesCode } from './input-types';
import { Naming } from './naming';
import { type MockedOperationNode, mockedOperations } from './operations';
import { type CheckedOptions, checkedOptions } from './options';

export type { CodegenMswConfig, DocumentFile } from './config';

/** Where the generated file takes `mockOperation` and the refusals from. */
const RUNTIME = '@nxgt/graphql-codegen-msw/runtime';

/**
 * The graphql-codegen plugin: one msw handler factory per named query and
 * mutation of `documents`, `mock<Operation>(resolver, options?)`, typed with
 * the operation's result and variables types, its variables checked with
 * `@nxgt/graphql-codegen-zod`'s schema before the resolver runs. The schema
 * gives the input types the variables reach, written once as `inputTypes`
 * for the answer to a value graphql refuses.
 */
export function plugin(
	schema: GraphQLSchema,
	documents: readonly DocumentFile[],
	config: CodegenMswConfig = {},
): string {
	const options = checkedOptions(config);
	const naming = new Naming(config);
	const operations = mockedOperations(documents);
	const handlers = operations.map(({ name, kind }) =>
		naming.handler(name, kind),
	);
	const twice = handlers.find(
		(handler, index) => handlers.indexOf(handler) !== index,
	);
	if (twice) {
		throw new Error(
			`@nxgt/graphql-codegen-msw: the file would declare ${twice} twice: two operations give it the same name. Rename one of them.`,
		);
	}
	const imports = new Imports([
		'endpoint',
		'invalidInput',
		'inputTypes',
		...handlers,
	]);
	// Only what the file uses is imported: no operation, no handler types.
	const any = operations.length > 0;
	const handler = any ? imports.type('msw/graphql', 'GraphQLHandler') : '';
	const runtime = {
		resolver: any ? imports.type(RUNTIME, 'GraphQLMockResolver') : '',
		options: any ? imports.type(RUNTIME, 'MockOptions') : '',
		invalidInput: imports.type(RUNTIME, 'InvalidInput'),
		inputTypes: any ? imports.type(RUNTIME, 'InputTypes') : '',
		mock: any ? imports.value(RUNTIME, 'mockOperation') : '',
	};
	const refusal = refusalCode(options, imports);
	const blocks = operations.map((operation) => {
		const { name, kind } = operation;
		const result = imports.type(options.typesImport, naming.result(name, kind));
		const variables = imports.type(
			options.typesImport,
			naming.variables(name, kind),
		);
		const schema = imports.value(
			options.schemasImport,
			naming.schema(naming.variables(name, kind)),
		);
		return handlerBlock(operation, naming.handler(name, kind), {
			...runtime,
			handler,
			result,
			variables,
			schema,
		});
	});
	return `${[
		imports.lines().join('\n'),
		`/** Where the client sends its operations; a handler's \`options.endpoint\` overrides it. */\nexport const endpoint = ${JSON.stringify(options.endpoint)};`,
		`/** How an invalid input is answered, without calling the resolver. */\nexport const invalidInput: ${runtime.invalidInput} = ${refusal};`,
		...(any ? [inputTypesBlock(schema, operations, runtime.inputTypes)] : []),
		...blocks,
	].join('\n\n')}\n`;
}

/** The source of the `invalidInput` constant, its imports added. */
function refusalCode(options: CheckedOptions, imports: Imports): string {
	const choice = options.invalidInput;
	if (choice.kind === 'bad-user-input')
		return imports.value(RUNTIME, 'badUserInputRefusal');
	if (choice.kind === 'own')
		return imports.value(choice.fn.module, choice.fn.exported);
	const refusal = imports.value(RUNTIME, 'invalidInputRefusal');
	if (!choice.translate) return `${refusal}()`;
	const translate = imports.value(
		choice.translate.module,
		choice.translate.exported,
	);
	return `${refusal}({ ${translate === 'translate' ? translate : `translate: ${translate}`} })`;
}

/** The file's private `inputTypes`, which every handler passes on. */
function inputTypesBlock(
	schema: GraphQLSchema,
	operations: readonly MockedOperationNode[],
	type: string,
): string {
	const code = inputTypesCode(
		schema,
		operations.map(({ node }) => node),
	);
	return [
		'/**',
		' * The input types the variables reach, from the schema: how a handler words',
		' * a value graphql refuses. Internal: its shape may change in any version.',
		' */',
		`const inputTypes: ${type} = ${code};`,
	].join('\n');
}

/** The local names one handler's source uses. */
interface HandlerNames {
	readonly handler: string;
	readonly resolver: string;
	readonly options: string;
	readonly mock: string;
	readonly result: string;
	readonly variables: string;
	readonly schema: string;
}

function handlerBlock(
	{ name, kind, node }: MockedOperationNode,
	factory: string,
	names: HandlerNames,
): string {
	const operation = `{ type: ${JSON.stringify(kind)}, name: ${JSON.stringify(name)}, variables: ${names.schema}, variableTypes: ${variableTypesCode(node)}, inputTypes, endpoint, invalidInput }`;
	return [
		`/** Mocks the ${name} ${kind}: \`resolver\` answers once the variables pass \`${names.schema}\`. */`,
		`export function ${factory}(`,
		`\tresolver: ${names.resolver}<${names.result}, ${names.variables}>,`,
		`\toptions?: ${names.options},`,
		`): ${names.handler} {`,
		`\treturn ${names.mock}(${operation}, resolver, options);`,
		'}',
	].join('\n');
}
