import {
	GraphQLBoolean,
	GraphQLFloat,
	GraphQLID,
	type GraphQLInputField,
	type GraphQLInputObjectType,
	type GraphQLInputType,
	GraphQLInt,
	type GraphQLNamedInputType,
	GraphQLString,
	getNamedType,
	isEnumType,
	isInputObjectType,
	isListType,
	isNonNullType,
} from 'graphql';
import { defaultLiteral } from './defaults';
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
 * An input type in a cycle, declared with its types written out, since
 * TypeScript cannot infer them: `Filter` (what the resolver receives),
 * `FilterInput` (what a client sends), and `zFilter` typed by both. The
 * schema's types must fit inside them, a type error otherwise; a type
 * written wider than the schema would compile, so test/types.ts pins them.
 */
export function declareCyclic(
	type: GraphQLInputObjectType,
	code: string,
	writer: Writer,
	naming: Naming,
	cyclic: ReadonlySet<string>,
): string {
	const types = new TypeCode(writer, naming, cyclic);
	const output = naming.type(type.name);
	const input = `${output}Input`;
	const doc = docComment(type.description);
	return [
		`${doc}export type ${output} = ${types.object(type, 'output')};`,
		`${doc}export type ${input} = ${types.object(type, 'input')};`,
		`${doc}export const ${naming.schema(output)}: z.ZodType<${output}, ${input}> = ${code};`,
	].join('\n');
}

/** The TypeScript type of a value, on the way in or on the way out. */
class TypeCode {
	readonly #writer: Writer;
	readonly #naming: Naming;
	readonly #cyclic: ReadonlySet<string>;

	constructor(writer: Writer, naming: Naming, cyclic: ReadonlySet<string>) {
		this.#writer = writer;
		this.#naming = naming;
		this.#cyclic = cyclic;
	}

	/** An input object's fields, or, for `@oneOf`, one member set. */
	object(type: GraphQLInputObjectType, side: Side): string {
		const fields = Object.values(type.getFields());
		if (type.isOneOf)
			return fields
				.map(
					(field) => `{ ${field.name}: ${this.#required(field.type, side)} }`,
				)
				.join(' | ');
		const members = fields.map(
			(field) =>
				`${docComment(field.description, '\t')}\t${this.#member(field, side)};`,
		);
		return `{\n${members.join('\n')}\n}`;
	}

	/**
	 * A field as `Writer.value` writes it: optional on the way in when it
	 * is nullable or has a default; on the way out, present when it has a
	 * default, else optional when nullable.
	 */
	#member(field: GraphQLInputField, side: Side): string {
		const nullable = !isNonNullType(field.type);
		const filled = defaultLiteral(field) !== undefined;
		const type = this.#required(field.type, side);
		if (!nullable)
			return side === 'input' && filled
				? `${field.name}?: ${type} | undefined`
				: `${field.name}: ${type}`;
		if (side === 'output' && filled) return `${field.name}: ${type} | null`;
		return `${field.name}?: ${type} | null | undefined`;
	}

	/** `type` without its null: a list, a named type. */
	#required(type: GraphQLInputType, side: Side): string {
		if (isNonNullType(type)) return this.#required(type.ofType, side);
		if (!isListType(type)) return this.#named(type, side);
		const item = isNonNullType(type.ofType)
			? this.#required(type.ofType, side)
			: `${this.#required(type.ofType, side)} | null | undefined`;
		const list = `Array<${item}>`;
		// A single value for a list, as `Writer` takes it.
		return side === 'input'
			? `${this.#named(getNamedType(type), side)} | ${list}`
			: list;
	}

	#named(type: GraphQLNamedInputType, side: Side): string {
		const builtIn = builtIns[type.name];
		if (builtIn) return builtIn;
		if (isEnumType(type))
			return `z.output<typeof ${this.#writer.schemaName(type)}>`;
		if (isInputObjectType(type)) {
			const name = this.#naming.type(type.name);
			if (this.#cyclic.has(type.name))
				return side === 'output' ? name : `${name}Input`;
			return `z.${side}<typeof ${this.#writer.schemaName(type)}>`;
		}
		return `z.${side}<typeof ${this.#writer.scalarCode(type)}>`;
	}
}
