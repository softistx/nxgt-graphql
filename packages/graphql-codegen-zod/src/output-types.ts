import {
	GraphQLBoolean,
	type GraphQLField,
	GraphQLFloat,
	GraphQLID,
	GraphQLInt,
	type GraphQLNamedOutputType,
	type GraphQLObjectType,
	type GraphQLOutputType,
	GraphQLString,
	isAbstractType,
	isEnumType,
	isListType,
	isNonNullType,
	isObjectType,
} from 'graphql';
import type { Naming } from './naming';
import { docComment } from './source';
import type { Writer } from './writer';

type Side = 'input' | 'output';

const builtIns: Readonly<Record<string, string>> = {
	[GraphQLString.name]: 'string',
	[GraphQLID.name]: 'string',
	[GraphQLInt.name]: 'number',
	[GraphQLFloat.name]: 'number',
	[GraphQLBoolean.name]: 'boolean',
};

/**
 * An object type in a cycle, declared with its types written out, as an
 * input type in a cycle is: `User` (what a resolver returns, scalars
 * decoded), `UserWire` (the wire value, apart from an SDL `UserInput`) and `zUser` typed by both.
 */
export function declareCyclicObject(
	type: GraphQLObjectType,
	code: string,
	context: OutputTypeContext,
): string {
	const types = new OutputTypeCode(context);
	const output = context.naming.type(type.name);
	const input = `${output}Wire`;
	const doc = docComment(type.description);
	return [
		`${doc}export type ${output} = ${types.object(type, 'output')};`,
		`${doc}export type ${input} = ${types.object(type, 'input')};`,
		`${doc}export const ${context.naming.schema(output)}: z.ZodType<${output}, ${input}> = ${code};`,
	].join('\n');
}

export interface OutputTypeContext {
	readonly writer: Writer;
	readonly naming: Naming;
	readonly cyclic: ReadonlySet<string>;
}

class OutputTypeCode {
	readonly #context: OutputTypeContext;

	constructor(context: OutputTypeContext) {
		this.#context = context;
	}

	object(type: GraphQLObjectType, side: Side): string {
		const members = [
			`\t__typename?: ${JSON.stringify(type.name)} | undefined;`,
			...Object.values(type.getFields()).map(
				(field) =>
					`${docComment(field.description, '\t')}\t${this.#member(field, side)};`,
			),
		];
		return `{\n${members.join('\n')}\n}`;
	}

	#member(field: GraphQLField<unknown, unknown>, side: Side): string {
		const type = this.#required(field.type, side);
		return isNonNullType(field.type)
			? `${field.name}: ${type}`
			: `${field.name}?: ${type} | null | undefined`;
	}

	#required(type: GraphQLOutputType, side: Side): string {
		if (isNonNullType(type)) return this.#required(type.ofType, side);
		if (!isListType(type)) return this.#named(type, side);
		const item = this.#required(type.ofType, side);
		return isNonNullType(type.ofType)
			? `Array<${item}>`
			: `Array<${item} | null | undefined>`;
	}

	#named(type: GraphQLNamedOutputType, side: Side): string {
		const { writer, naming, cyclic } = this.#context;
		const builtIn = builtIns[type.name];
		if (builtIn) return builtIn;
		if (isEnumType(type)) return `z.output<typeof ${writer.schemaName(type)}>`;
		// The abstract type's own schema, inferred from its members': one
		// name per field, not its member list copied into each.
		if (isAbstractType(type))
			return `z.${side}<typeof ${naming.schema(naming.type(type.name))}>`;
		if (isObjectType(type)) {
			const name = naming.type(type.name);
			if (cyclic.has(type.name))
				return side === 'output' ? name : `${name}Wire`;
			return `z.${side}<typeof ${naming.schema(name)}>`;
		}
		return `z.${side}<typeof ${writer.scalarCode(type)}>`;
	}
}
