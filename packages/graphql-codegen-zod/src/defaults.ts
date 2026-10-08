import * as graphql from 'graphql';
import {
	astFromValue,
	type ConstValueNode,
	type GraphQLArgument,
	GraphQLID,
	type GraphQLInputField,
	type GraphQLInputType,
	getNamedType,
	getNullableType,
	isInputObjectType,
	isListType,
	isNonNullType,
	isScalarType,
	isSpecifiedScalarType,
	Kind,
	valueFromASTUntyped,
} from 'graphql';

/**
 * A default's value as the client parses it: its literal coerced as
 * graphql coerces it. An integer a JavaScript number cannot keep exact,
 * given to an ID or a custom scalar, fails, naming `where`: the server
 * would hand the scalar every digit. An Int or a Float rounds on both sides.
 */
export function parsedDefault(
	literal: ConstValueNode,
	type: GraphQLInputType,
	where: string,
): unknown {
	assertExact(literal, type, where);
	return coerced(valueFromASTUntyped(literal), type);
}

function assertExact(
	literal: ConstValueNode,
	type: GraphQLInputType,
	where: string,
): void {
	const nullable = getNullableType(type);
	if (isListType(nullable)) {
		const items = literal.kind === Kind.LIST ? literal.values : [literal];
		for (const item of items) assertExact(item, nullable.ofType, where);
		return;
	}
	if (isInputObjectType(nullable)) {
		if (literal.kind !== Kind.OBJECT) return;
		const fields = nullable.getFields();
		for (const field of literal.fields) {
			const definition = fields[field.name.value];
			if (definition) assertExact(field.value, definition.type, where);
		}
		return;
	}
	const keeps =
		nullable === GraphQLID ||
		(isScalarType(nullable) && !isSpecifiedScalarType(nullable));
	if (
		keeps &&
		literal.kind === Kind.INT &&
		!Number.isSafeInteger(Number(literal.value))
	)
		throw new Error(
			`@nxgt/graphql-codegen-zod: the default of ${where} holds ${literal.value}, which a JavaScript number cannot keep exact. Write it as a string, if its scalar takes one.`,
		);
}

/**
 * The default of an argument or input field as a literal: its SDL's, or,
 * for a schema built without SDL (introspected), its value written back.
 * graphql 16 holds that value in `defaultValue`, graphql 17 in `default`.
 */
export function defaultLiteral(
	input: GraphQLArgument | GraphQLInputField,
): ConstValueNode | undefined {
	if (input.astNode) return input.astNode.defaultValue;
	const loose = input as {
		defaultValue?: unknown;
		default?: { value?: unknown; literal?: ConstValueNode };
	};
	if (loose.default?.literal) return loose.default.literal;
	if (loose.default) {
		// graphql 17: an external value, written back by valueToLiteral.
		const toLiteral = (
			graphql as {
				valueToLiteral?: (
					value: unknown,
					type: GraphQLInputType,
				) => ConstValueNode | undefined;
			}
		).valueToLiteral;
		if (loose.default.value === undefined || !toLiteral) return undefined;
		return toLiteral(loose.default.value, input.type);
	}
	// graphql 16: an internal value, written back by astFromValue.
	if (loose.defaultValue === undefined) return undefined;
	return (astFromValue(loose.defaultValue, input.type) ?? undefined) as
		| ConstValueNode
		| undefined;
}

/**
 * A default as graphql coerces it, through lists and input objects: a
 * single value given for a list is a list of it (`[String!] = "a"` is
 * `["a"]`, `[[Int]] = 1` is `[[1]]`), at any depth.
 */
export function coerced(value: unknown, type: GraphQLInputType): unknown {
	const nullable = isNonNullType(type) ? type.ofType : type;
	if (value === null || value === undefined) return value;
	if (isListType(nullable)) {
		const items = Array.isArray(value) ? value : [value];
		return items.map((item) => coerced(item, nullable.ofType));
	}
	if (isInputObjectType(nullable) && typeof value === 'object') {
		const fields = nullable.getFields();
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, field]) => {
				const definition = fields[key];
				return [key, definition ? coerced(field, definition.type) : field];
			}),
		);
	}
	// graphql takes an Int for an ID, and the resolver gets its string.
	if (getNamedType(nullable) === GraphQLID && typeof value === 'number')
		return String(value);
	return value;
}
