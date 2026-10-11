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
 * reach, input objects followed field by field, sorted by name so the file
 * does not move when the documents are reordered; a scalar on one line, an
 * input object's fields and an enum's values one per line.
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
	const entries = [...reached.values()]
		.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.map((type) => `\t${type.name}: ${entryCode(type)},`);
	return entries.length > 0 ? `{\n${entries.join('\n')}\n}` : '{}';
}

function namedTypeOf(type: TypeNode): string {
	return type.kind === Kind.NAMED_TYPE
		? type.name.value
		: namedTypeOf(type.type);
}

/**
 * One type's entry: a scalar on its line, an input object one field per
 * line and an enum one value per line, so a schema change moves the lines
 * it changes only.
 */
function entryCode(type: GraphQLNamedType): string {
	if (isInputObjectType(type)) {
		const fields = Object.values(type.getFields()).map(
			(field) => `${field.name}: ${JSON.stringify(fieldSource(field))}`,
		);
		return block([
			'kind: "input"',
			`fields: ${block(fields, 2)}`,
			...(type.isOneOf ? ['oneOf: true'] : []),
		]);
	}
	if (isEnumType(type)) {
		const values = type.getValues().map((value) => JSON.stringify(value.name));
		return block(['kind: "enum"', `values: ${list(values, 2)}`]);
	}
	return isSpecifiedScalarType(type)
		? '{ kind: "builtin" }'
		: '{ kind: "scalar" }';
}

/** `{ … }`, one property per line at `depth` tabs, its brace one tab less. */
function block(properties: readonly string[], depth = 1): string {
	return wrapped('{', '}', properties, depth);
}

/** `[ … ]`, one item per line, as `block`. */
function list(items: readonly string[], depth: number): string {
	return wrapped('[', ']', items, depth);
}

function wrapped(
	open: string,
	close: string,
	items: readonly string[],
	depth: number,
): string {
	if (items.length === 0) return `${open}${close}`;
	const indent = '\t'.repeat(depth + 1);
	const lines = items.map((item) => `${indent}${item},`);
	return `${open}\n${lines.join('\n')}\n${'\t'.repeat(depth)}${close}`;
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
