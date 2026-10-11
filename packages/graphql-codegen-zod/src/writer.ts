import {
	type Constraint,
	type InputCodeOptions,
	inputCode,
} from '@nxgt/graphql-validation/codegen';
import {
	type ConstValueNode,
	type GraphQLDirective,
	type GraphQLInputType,
	type GraphQLNamedInputType,
	GraphQLNonNull,
	type GraphQLScalarType,
	getNamedType,
	isEnumType,
	isInputObjectType,
	isListType,
	isNonNullType,
	isSpecifiedScalarType,
} from 'graphql';
import { parsedDefault } from './defaults';
import type { FormatCode } from './formats';
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
	readonly #formats: FormatCode;
	readonly #options: InputCodeOptions;

	constructor(
		directive: GraphQLDirective | undefined,
		naming: Naming,
		scalars: ScalarSources,
		formats: FormatCode,
	) {
		this.directive = directive;
		this.#naming = naming;
		this.#scalars = scalars;
		this.#formats = formats;
		// An application format is a reference to its schema, chained on.
		this.#options = { list: singleOrList, format: formats.code };
	}

	/** The source of a custom scalar's schema, from its mapping. */
	scalarCode(type: GraphQLScalarType): string {
		return this.#scalars.code(type);
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
			return {
				code: inputCode(
					type,
					constraints,
					where,
					named,
					this.#options,
					this.#formats.schemas,
				),
				lazy,
			};
		// The default parsed as the client's value would be, then null allowed
		// after it: the key is optional on the way in, present on the way out.
		const nullable = !isNonNullType(type);
		const required = inputCode(
			nullable ? new GraphQLNonNull(type) : type,
			constraints,
			where,
			named,
			this.#options,
			this.#formats.schemas,
		);
		const value = JSON.stringify(parsedDefault(defaultValue, type, where));
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
 * A list that also takes a single value, as graphql coerces it (`"a"` for
 * `[String]` is `["a"]`, for `[[String]]` `[["a"]]`). The union only gives
 * the value its shape, parsing nothing: a list as it was sent, a single
 * value wrapped. Then it is piped into `code`, the list's own schema with
 * every rule, the server's: its items are parsed once, there, and a rule
 * refuses with the message, and at the path, the server gives (`[0]` for
 * a single value). Never `null`: a nullable list says so with its own
 * `.nullish()`, and graphql never wraps a null.
 *
 * Nothing that can fail sits inside an option: zod 4.6.6 aborts an
 * oversized array before its items, and a union with every option aborted
 * reports `invalid_union`, not the list too long. `code` after the union
 * checks size and items as the server's array does, under any zod.
 */
const singleOrList: NonNullable<InputCodeOptions['list']> = ({
	type,
	code,
	single,
}) => {
	const one = singleInput(getNamedType(type), single);
	return `z.union([z.array(z.custom<${itemInput(type.ofType, one)}>()), z.custom<${one}>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value])]).pipe(${code})`;
};

/** What a client may send for one value of a list's named type, as a type. */
function singleInput(named: GraphQLNamedInputType, single: string): string {
	if (isSpecifiedScalarType(named))
		return BUILT_IN_INPUTS[named.name] ?? 'string';
	return `z.input<typeof ${single}>`;
}

/** The built-in scalars' input types, as `baseCode` parses them. */
const BUILT_IN_INPUTS: Readonly<Record<string, string>> = {
	String: 'string',
	ID: 'string',
	Int: 'number',
	Float: 'number',
	Boolean: 'boolean',
};

/**
 * What a client may send for one item of a list, as a type: what its
 * schema's `z.input` is, so the union types the list as `code` would.
 */
function itemInput(type: GraphQLInputType, one: string): string {
	if (isNonNullType(type)) return requiredInput(type.ofType, one);
	return `${requiredInput(type, one)} | null | undefined`;
}

function requiredInput(type: GraphQLInputType, one: string): string {
	if (isNonNullType(type)) return requiredInput(type.ofType, one);
	// An inner list takes a single value too.
	if (isListType(type)) return `Array<${itemInput(type.ofType, one)}> | ${one}`;
	return one;
}
