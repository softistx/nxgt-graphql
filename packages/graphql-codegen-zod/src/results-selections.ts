import {
	type FragmentDefinitionNode,
	type GraphQLAbstractType,
	type GraphQLCompositeType,
	type GraphQLObjectType,
	type GraphQLOutputType,
	type GraphQLSchema,
	isEnumType,
	isListType,
	isNonNullType,
	isObjectType,
	isScalarType,
} from 'graphql';
import { type Collected, collectFields, type Selected } from './collect-fields';
import { builtIns } from './objects-output';
import type { Writer } from './writer';

const failure = '@nxgt/graphql-codegen-zod:';
// Where a member's `__typename` goes, filled once its group is known. No
// GraphQL name and no module path holds a NUL.
const typename = '\u0000typename\u0000';
// Past this many nested selections, one is declared as its own const:
// TypeScript infers nested `z.object`s only so deep (TS2589 at 14).
const hoistDepth = 5;

/**
 * The schema of a selection, for a response: what was selected, under its
 * alias. Deep selections are declared apart, as `<schema>$<n>`, which the
 * caller writes before the schema that uses them.
 */
export class Selections {
	readonly #schema: GraphQLSchema;
	readonly #fragments: ReadonlyMap<string, FragmentDefinitionNode>;
	readonly #writer: Writer;
	#hoisted = new Map<string, string>();
	#prefix = '';

	constructor(
		schema: GraphQLSchema,
		fragments: ReadonlyMap<string, FragmentDefinitionNode>,
		writer: Writer,
	) {
		this.#schema = schema;
		this.#fragments = fragments;
		this.#writer = writer;
	}

	/**
	 * The schema `sets` select on `type`, declared as `name`, after the
	 * consts it hoists. `path` names where, for errors.
	 */
	declare(
		name: string,
		type: GraphQLCompositeType,
		sets: readonly Selected[],
		path: string,
	): { readonly hoisted: string[]; readonly code: string } {
		this.#hoisted = new Map();
		this.#prefix = name;
		const code = this.#code(type, sets, [path], '', 0);
		return {
			// Typed by an alias of its own inference: a reference to it then
			// starts TypeScript's depth over.
			hoisted: [...this.#hoisted].map(
				([body, hoisted]) =>
					`const ${hoisted}$ = ${body};\nconst ${hoisted}: z.ZodType<z.output<typeof ${hoisted}$>, z.input<typeof ${hoisted}$>> = ${hoisted}$;`,
			),
			code,
		};
	}

	#code(
		type: GraphQLCompositeType,
		sets: readonly Selected[],
		path: readonly string[],
		indent: string,
		depth: number,
	): string {
		if (depth >= hoistDepth) {
			const body = this.#code(type, sets, path, '', 0);
			const known = this.#hoisted.get(body);
			if (known) return known;
			const name = `${this.#prefix}$${this.#hoisted.size + 1}`;
			this.#hoisted.set(body, name);
			return name;
		}
		if (isObjectType(type))
			return this.#object(type, sets, path, indent, depth).replaceAll(
				typename,
				`z.literal(${JSON.stringify(type.name)})`,
			);
		return this.#abstract(type, sets, path, indent, depth);
	}

	/**
	 * An interface's or a union's selection: one object per group of
	 * possible types that select the same, a union discriminated on
	 * `__typename` when there is more than one group.
	 */
	#abstract(
		type: GraphQLAbstractType,
		sets: readonly Selected[],
		path: readonly string[],
		indent: string,
		depth: number,
	): string {
		const members = this.#schema.getPossibleTypes(type);
		if (members.length === 0) return 'z.never()';
		const inner = `${indent}\t`;
		const groups = new Map<string, GraphQLObjectType[]>();
		const keys = new Map<string, readonly string[]>();
		for (const member of members) {
			const code = this.#object(member, sets, path, inner, depth);
			groups.set(code, [...(groups.get(code) ?? []), member]);
			keys.set(
				member.name,
				[...collectFields(this.#schema, this.#fragments, member, sets)]
					.filter(([, field]) => field.name === '__typename' && !field.optional)
					.map(([key]) => key),
			);
		}
		const fill = (code: string, group: readonly GraphQLObjectType[]) => {
			const names = group.map((member) => JSON.stringify(member.name));
			return code.replaceAll(
				typename,
				names.length === 1
					? `z.literal(${names[0]})`
					: `z.enum([${names.join(', ')}])`,
			);
		};
		const all = [...groups];
		if (all.length === 1) {
			const [code = '', group = []] = all[0] ?? [];
			// Rendered one level in; back to this one.
			return fill(code.replaceAll(`\n${inner}`, `\n${indent}`), group);
		}
		const discriminator = this.#discriminator(type.name, keys, path);
		return `z.discriminatedUnion(${JSON.stringify(discriminator)}, [\n${all
			.map(([code, group]) => `${inner}${fill(code, group)},`)
			.join('\n')}\n${indent}])`;
	}

	/** The key every member selects `__typename` under, `__typename` first. */
	#discriminator(
		type: string,
		keys: ReadonlyMap<string, readonly string[]>,
		path: readonly string[],
	): string {
		for (const [member, selected] of keys)
			if (selected.length === 0)
				throw new Error(
					`${failure} ${path.join('.')} selects the abstract type ${type} without __typename for ${member}. Select __typename there, so the result tells its members apart.`,
				);
		const lists = [...keys.values()];
		const shared = (lists[0] ?? []).filter((key) =>
			lists.every((selected) => selected.includes(key)),
		);
		const key = shared.includes('__typename') ? '__typename' : shared[0];
		if (key === undefined)
			throw new Error(
				`${failure} ${path.join('.')} selects __typename under a different key for each member of ${type} (${[...new Set(lists.flat())].join(', ')}). Select it under one key for every member, so the result tells its members apart.`,
			);
		return key;
	}

	/** An object type's selection, its `__typename` left to the caller. */
	#object(
		type: GraphQLObjectType,
		sets: readonly Selected[],
		path: readonly string[],
		indent: string,
		depth: number,
	): string {
		const inner = `${indent}\t`;
		const members = [
			...collectFields(this.#schema, this.#fragments, type, sets),
		].map(([key, field]) => {
			const code = this.#field(type, field, [...path, key], inner, depth);
			return `${inner}${key}: ${field.optional ? `${code}.optional()` : code},`;
		});
		return members.length === 0
			? 'z.object({})'
			: `z.object({\n${members.join('\n')}\n${indent}})`;
	}

	#field(
		parent: GraphQLObjectType,
		field: Collected,
		path: readonly string[],
		indent: string,
		depth: number,
	): string {
		if (field.name === '__typename') return typename;
		const definition = parent.getFields()[field.name];
		// An introspection field: `__schema`, `__type`.
		if (!definition) return 'z.unknown()';
		// A field selected by one conditional node is there only when that
		// condition held, so its sub-fields need not be optional again.
		const implied = field.optional && field.nodes.length === 1;
		const sets = field.nodes.flatMap(({ node, conditional }) =>
			node.selectionSet
				? [{ set: node.selectionSet, conditional: conditional && !implied }]
				: [],
		);
		return this.#nullable(definition.type, sets, path, indent, depth + 1);
	}

	#nullable(
		type: GraphQLOutputType,
		sets: readonly Selected[],
		path: readonly string[],
		indent: string,
		depth: number,
	): string {
		if (isNonNullType(type))
			return this.#required(type.ofType, sets, path, indent, depth);
		return `${this.#required(type, sets, path, indent, depth)}.nullable()`;
	}

	#required(
		type: GraphQLOutputType,
		sets: readonly Selected[],
		path: readonly string[],
		indent: string,
		depth: number,
	): string {
		if (isNonNullType(type))
			return this.#required(type.ofType, sets, path, indent, depth);
		if (isListType(type))
			return `z.array(${this.#nullable(type.ofType, sets, path, indent, depth)})`;
		if (isScalarType(type))
			return builtIns[type.name] ?? this.#writer.scalarCode(type);
		if (isEnumType(type)) return this.#writer.schemaName(type);
		return this.#code(type, sets, path, indent, depth);
	}
}
