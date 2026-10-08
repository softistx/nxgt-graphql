import { type Constraint, inputCode } from '@nxgt/graphql-validation/codegen';
import * as graphql from 'graphql';
import {
	astFromValue,
	type ConstValueNode,
	type GraphQLArgument,
	type GraphQLDirective,
	GraphQLID,
	type GraphQLInputField,
	type GraphQLInputType,
	type GraphQLNamedInputType,
	GraphQLNonNull,
	getNamedType,
	isEnumType,
	isInputObjectType,
	isListType,
	isNonNullType,
	valueFromASTUntyped,
} from 'graphql';
import type { Naming } from './naming';
import type { ScalarSources } from './scalars';

/** One value's schema as source, and whether it names an input object. */
export interface ValueCode {
	readonly code: string;
	/** Written behind a getter: the input object may not be declared yet. */
	readonly lazy: boolean;
	/** The member's doc comment, from its GraphQL description. */
	readonly description?: string | null | undefined;
}

/**
 * Writes the schema of a value of a GraphQL input type: an argument, an
 * input field, an operation variable. Enums and input objects are named by
 * their schema, custom scalars come from their mapping, and the rest is
 * `@nxgt/graphql-validation`'s `inputCode`, constraints included.
 */
export class Writer {
	readonly directive: GraphQLDirective | undefined;
	readonly #naming: Naming;
	readonly #scalars: ScalarSources;

	constructor(
		directive: GraphQLDirective | undefined,
		naming: Naming,
		scalars: ScalarSources,
	) {
		this.directive = directive;
		this.#naming = naming;
		this.#scalars = scalars;
	}

	/** The schema's name of an enum or an input object. */
	schemaName(type: GraphQLNamedInputType): string {
		return this.#naming.schema(this.#naming.type(type.name));
	}

	/**
	 * `type`'s schema with `constraints`, `where` naming it in errors. A
	 * default makes the value optional on the way in and present on the way
	 * out, as graphql fills it: `.prefault(<default>)`, then `.nullable()`.
	 */
	value(
		type: GraphQLInputType,
		constraints: readonly Constraint[],
		where: string,
		defaultValue?: ConstValueNode,
	): ValueCode {
		let lazy = false;
		const named = (named: GraphQLNamedInputType): string => {
			if (isInputObjectType(named)) {
				lazy = true;
				return this.schemaName(named);
			}
			if (isEnumType(named)) return this.schemaName(named);
			return this.#scalars.code(named);
		};
		if (!defaultValue)
			return { code: inputCode(type, constraints, where, named), lazy };
		// The default parsed as the client's value would be, then null allowed
		// after it: the key is optional on the way in, present on the way out.
		const nullable = !isNonNullType(type);
		const required = inputCode(
			nullable ? new GraphQLNonNull(type) : type,
			constraints,
			where,
			named,
		);
		const value = JSON.stringify(
			coerced(valueFromASTUntyped(defaultValue), type),
		);
		return {
			code: `${required}.prefault(${value})${nullable ? '.nullable()' : ''}`,
			lazy,
		};
	}

	/** `value` for a type made non-null: a `@oneOf` member, which is set. */
	required(
		type: GraphQLInputType,
		constraints: readonly Constraint[],
		where: string,
	): ValueCode {
		return this.value(
			isNonNullType(type) ? type : new GraphQLNonNull(type),
			constraints,
			where,
		);
	}
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
function coerced(value: unknown, type: GraphQLInputType): unknown {
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

/** A GraphQL description as a doc comment, or nothing. */
export function docComment(
	description: string | null | undefined,
	indent = '',
): string {
	if (!description) return '';
	const lines = description
		.replaceAll('\r\n', '\n')
		.replaceAll('*/', '*\\/')
		.split('\n');
	if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
	return `${indent}/**\n${lines.map((line) => `${indent} * ${line}`.trimEnd()).join('\n')}\n${indent} */\n`;
}

/** The members of a `z.object({...})`, a getter for each lazy one. */
export function objectMembers(
	members: readonly (readonly [string, ValueCode])[],
): string {
	return members
		.map(([name, { code, lazy, description }]) => {
			const doc = docComment(description, '\t');
			return lazy
				? `${doc}\tget ${name}() {\n\t\treturn ${code};\n\t},`
				: `${doc}\t${name}: ${code},`;
		})
		.join('\n');
}
