import {
	Kind,
	type OperationDefinitionNode,
	parse,
	type VariableDefinitionNode,
} from 'graphql';

/**
 * One GraphQL type the variables reach, as the generated file describes it
 * from the schema: a built-in scalar (`String`, `Int`, `Float`, `Boolean`,
 * `ID`), a custom scalar, an enum and its values, or an input object and
 * the type of each field (`"[String!]"`, `"Int! = 1"` with a default).
 *
 * Internal: written by the plugin and read by the coercion answer only. Its
 * form may change in any version, together with the generated file.
 */
export type InputType =
	| { readonly kind: 'builtin' }
	| { readonly kind: 'scalar' }
	| { readonly kind: 'enum'; readonly values: readonly string[] }
	| {
			readonly kind: 'input';
			readonly fields: Readonly<Record<string, string>>;
			readonly oneOf?: true;
	  };

/** The input types of one generated file, by name. Internal, as `InputType`. */
export type InputTypes = Readonly<Record<string, InputType>>;

/** A type as graphql-js walks it: non-null and list wrappers around a name. */
export type TypeRef =
	| { readonly kind: 'non-null'; readonly of: TypeRef }
	| { readonly kind: 'list'; readonly of: TypeRef }
	| { readonly kind: 'named'; readonly name: string };

/** A variable's or an input field's declaration: its type, and whether it has a default. */
export interface Declared {
	readonly type: TypeRef;
	readonly hasDefault: boolean;
}

/** `"[Int!]! = [1]"` read: the type before ` = `, a default after it. */
export function declared(source: string): Declared {
	const at = source.indexOf(' = ');
	const printed = at === -1 ? source : source.slice(0, at);
	return { type: typeRef(printed.trim()), hasDefault: at !== -1 };
}

function typeRef(printed: string): TypeRef {
	if (printed.endsWith('!'))
		return { kind: 'non-null', of: typeRef(printed.slice(0, -1)) };
	if (printed.startsWith('[') && printed.endsWith(']'))
		return { kind: 'list', of: typeRef(printed.slice(1, -1)) };
	return { kind: 'named', name: printed };
}

/** A type as graphql-js prints it in a message: `[Int!]!`. */
export function printType(type: TypeRef): string {
	switch (type.kind) {
		case 'non-null':
			return `${printType(type.of)}!`;
		case 'list':
			return `[${printType(type.of)}]`;
		default:
			return type.name;
	}
}

/**
 * The variables' definitions of the operation named `name` in the query the
 * client sent, by variable: where each error is located. Empty when the
 * query does not parse.
 */
export function definitionsOf(
	query: string,
	name: string,
): ReadonlyMap<string, VariableDefinitionNode> {
	let operations: OperationDefinitionNode[];
	try {
		operations = parse(query).definitions.filter(
			(node): node is OperationDefinitionNode =>
				node.kind === Kind.OPERATION_DEFINITION,
		);
	} catch {
		return new Map();
	}
	const operation =
		operations.find((node) => node.name?.value === name) ?? operations[0];
	return new Map(
		(operation?.variableDefinitions ?? []).map((node) => [
			node.variable.name.value,
			node,
		]),
	);
}
