import {
	type GraphQLInputField,
	type GraphQLNamedType,
	type GraphQLSchema,
	getNamedType,
	isEnumType,
	isInputObjectType,
	isNonNullType,
	isRequiredInputField,
	isSpecifiedScalarType,
	Kind,
	type OperationDefinitionNode,
	print,
	type TypeNode,
} from 'graphql';

// What the generated file tells the runtime of the variables, from the
// schema at generation time, so the mock words a value graphql refuses as
// graphql-yoga does: each variable's type, and every input type the
// variables reach (the runtime's `InputTypes`, an internal shape).

/** `{ first: "Int = 10", role: "Role" }`: each variable's type and default, as written. */
export function variableTypesCode(node: OperationDefinitionNode): string {
	const entries = (node.variableDefinitions ?? []).map((definition) => {
		const type = print(definition.type);
		const source = definition.defaultValue
			? `${type} = ${print(definition.defaultValue)}`
			: type;
		return `${definition.variable.name.value}: ${JSON.stringify(source)}`;
	});
	return entries.length > 0 ? `{ ${entries.join(', ')} }` : '{}';
}

/**
 * The `inputTypes` object's source: every type the operations' variables
 * reach, input objects followed field by field, one line per type, sorted
 * by name so the file does not move when the documents are reordered.
 */
export function inputTypesCode(
	schema: GraphQLSchema,
	operations: readonly OperationDefinitionNode[],
): string {
	const reached = new Map<string, GraphQLNamedType>();
	const visit = (type: GraphQLNamedType | undefined): void => {
		if (!type || reached.has(type.name)) return;
		reached.set(type.name, type);
		if (isInputObjectType(type))
			for (const field of Object.values(type.getFields()))
				visit(getNamedType(field.type));
	};
	for (const operation of operations)
		for (const definition of operation.variableDefinitions ?? [])
			visit(schema.getType(namedTypeOf(definition.type)) ?? undefined);
	const lines = [...reached.values()]
		.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.map((type) => `\t${type.name}: ${entryCode(type)},`);
	return lines.length > 0 ? `{\n${lines.join('\n')}\n}` : '{}';
}

function namedTypeOf(type: TypeNode): string {
	return type.kind === Kind.NAMED_TYPE
		? type.name.value
		: namedTypeOf(type.type);
}

function entryCode(type: GraphQLNamedType): string {
	if (isInputObjectType(type)) {
		const fields = Object.values(type.getFields()).map(
			(field) => `${field.name}: ${JSON.stringify(fieldSource(field))}`,
		);
		const body = fields.length > 0 ? `{ ${fields.join(', ')} }` : '{}';
		return `{ kind: "input", fields: ${body}${type.isOneOf ? ', oneOf: true' : ''} }`;
	}
	if (isEnumType(type)) {
		const values = type.getValues().map((value) => JSON.stringify(value.name));
		return `{ kind: "enum", values: [${values.join(', ')}] }`;
	}
	return isSpecifiedScalarType(type)
		? '{ kind: "builtin" }'
		: '{ kind: "scalar" }';
}

/**
 * `"Int! = 1"`: the field's type, and its default when it has one. Only a
 * non-null field's default changes what graphql refuses (it is then not
 * required); a schema built in code has no default to print, written `…`.
 */
function fieldSource(field: GraphQLInputField): string {
	const type = String(field.type);
	const literal = field.astNode?.defaultValue;
	if (literal) return `${type} = ${print(literal)}`;
	return isNonNullType(field.type) && !isRequiredInputField(field)
		? `${type} = …`
		: type;
}
