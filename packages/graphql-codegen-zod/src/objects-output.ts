import {
	GraphQLBoolean,
	GraphQLFloat,
	GraphQLID,
	GraphQLInt,
	type GraphQLInterfaceType,
	type GraphQLObjectType,
	type GraphQLOutputType,
	type GraphQLSchema,
	GraphQLString,
	type GraphQLUnionType,
	getNamedType,
	isAbstractType,
	isEnumType,
	isInterfaceType,
	isListType,
	isNonNullType,
	isObjectType,
	isScalarType,
	isUnionType,
} from 'graphql';
import { outputCycles } from './cycles';
import type { Naming } from './naming';
import { declareCyclicObject, type OutputTypeContext } from './output-types';
import { declare, objectMembers } from './source';
import type { ValueCode, Writer } from './writer';

const builtIns: Readonly<Record<string, string>> = {
	[GraphQLString.name]: 'z.string()',
	[GraphQLID.name]: 'z.string()',
	[GraphQLInt.name]: 'z.int32()',
	[GraphQLFloat.name]: 'z.number()',
	[GraphQLBoolean.name]: 'z.boolean()',
};

/**
 * The SDL's output types: every object type, then every interface and
 * union, typed `z.output`, what a resolver returns once custom scalars are
 * decoded. A field the schema does not declare is dropped (`z.object`), and
 * `__typename` is optional, as a resolver rarely sets it; so an interface
 * or a union is a plain `z.union` of its object types. Interfaces and
 * unions come last: their union reads the object schemas when the module
 * loads, while objects reach each other through getters.
 */
export function objectBlocks(
	schema: GraphQLSchema,
	writer: Writer,
	naming: Naming,
): string[] {
	const types = Object.values(schema.getTypeMap()).filter(
		(type) => !type.name.startsWith('__'),
	);
	const context = { writer, naming, cyclic: outputCycles(schema) };
	return [
		...types.filter(isObjectType).map((type) => objectBlock(type, context)),
		...types
			.filter(isAbstractType)
			.map((type) => abstractBlock(schema, type, naming)),
	];
}

function objectBlock(
	type: GraphQLObjectType,
	context: OutputTypeContext,
): string {
	const { writer, naming } = context;
	const typename: ValueCode = {
		code: `z.literal(${JSON.stringify(type.name)}).optional()`,
		lazy: false,
	};
	const members = Object.values(type.getFields()).map(
		(field) =>
			[
				field.name,
				{
					...outputCode(field.type, writer, naming),
					description: field.description,
				},
			] as const,
	);
	const code = `z.object({\n${objectMembers([['__typename', typename], ...members])}\n})`;
	return context.cyclic.has(type.name)
		? declareCyclicObject(type, code, context)
		: declare(naming.type(type.name), naming, code, 'output', type.description);
}

function abstractBlock(
	schema: GraphQLSchema,
	type: GraphQLInterfaceType | GraphQLUnionType,
	naming: Naming,
): string {
	const members = (
		isUnionType(type) ? type.getTypes() : schema.getPossibleTypes(type)
	).map((member) => naming.schema(naming.type(member.name)));
	const code =
		members.length === 0
			? 'z.never()'
			: members.length === 1
				? (members[0] ?? 'z.never()')
				: `z.union([${members.join(', ')}])`;
	return declare(
		naming.type(type.name),
		naming,
		code,
		'output',
		type.description,
	);
}

/** A field's schema: `.nullish()` unless non-null, a getter for a type. */
function outputCode(
	type: GraphQLOutputType,
	writer: Writer,
	naming: Naming,
): ValueCode {
	const named = getNamedType(type);
	const lazy = !isScalarType(named) && !isEnumType(named);
	return { code: nullable(type, writer, naming), lazy };
}

function nullable(
	type: GraphQLOutputType,
	writer: Writer,
	naming: Naming,
): string {
	if (isNonNullType(type)) return required(type.ofType, writer, naming);
	return `${required(type, writer, naming)}.nullish()`;
}

function required(
	type: GraphQLOutputType,
	writer: Writer,
	naming: Naming,
): string {
	if (isNonNullType(type)) return required(type.ofType, writer, naming);
	if (isListType(type))
		return `z.array(${nullable(type.ofType, writer, naming)})`;
	if (isScalarType(type)) return builtIns[type.name] ?? writer.scalarCode(type);
	if (isEnumType(type)) return writer.schemaName(type);
	if (isObjectType(type) || isInterfaceType(type) || isUnionType(type))
		return naming.schema(naming.type(type.name));
	return 'z.never()';
}
