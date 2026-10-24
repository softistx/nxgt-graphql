import {
	type ArgumentNode,
	type GraphQLField,
	type GraphQLNamedType,
	type GraphQLSchema,
	isAbstractType,
	type ValueNode,
} from 'graphql';

/** Sizes are plain numbers, held below this so a hostile query never reaches `Infinity`. */
const CEILING = Number.MAX_SAFE_INTEGER;

/** What sizing a list needs: the schema and the options of the rule. */
export interface SizeContext {
	schema: GraphQLSchema;
	sizeArguments: readonly string[];
	defaultFirst: number;
}

/** A non-negative integer, or `undefined`. */
function sizeOf(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
		? value
		: undefined;
}

/**
 * An argument's SDL default as a size. graphql 16 holds it as `defaultValue`;
 * graphql 17 as `default`, `{ value }` or `{ literal }` (an `IntValue`).
 */
function defaultSizeOf(argument: object | undefined): number | undefined {
	if (!argument) return undefined;
	if ('defaultValue' in argument) {
		const size = sizeOf(argument.defaultValue);
		if (size !== undefined) return size;
	}
	if (!('default' in argument)) return undefined;
	const fallback = argument.default;
	if (typeof fallback !== 'object' || fallback === null) return undefined;
	if ('value' in fallback) return sizeOf(fallback.value);
	if (
		'literal' in fallback &&
		typeof fallback.literal === 'object' &&
		fallback.literal !== null &&
		'kind' in fallback.literal &&
		fallback.literal.kind === 'IntValue' &&
		'value' in fallback.literal
	) {
		return sizeOf(Number(fallback.literal.value));
	}
	return undefined;
}

/** The size a literal gives: an Int of at least 0, or a string holding one. */
function literalSize(value: ValueNode): number | undefined {
	if (value.kind === 'IntValue') return sizeOf(Number(value.value));
	if (value.kind === 'StringValue' && /^(0|[1-9]\d*)$/.test(value.value)) {
		return Math.min(Number(value.value), CEILING);
	}
	return undefined;
}

/** The size one size argument sizes `definition`'s list at, `undefined` when it says nothing. */
function argumentSize(
	cost: SizeContext,
	definition: GraphQLField<unknown, unknown>,
	name: string,
	node: ArgumentNode | undefined,
): number | undefined {
	// Not a usable literal (a variable, a negative number): the argument's
	// own SDL default, else defaultFirst.
	const fallback = () =>
		defaultSizeOf(definition.args.find((arg) => arg.name === name));
	if (!node) return fallback();
	return literalSize(node.value) ?? fallback() ?? cost.defaultFirst;
}

/** The size of the list `definition` returns, as selected by `args`: the largest its size arguments say. */
function sizeIn(
	cost: SizeContext,
	definition: GraphQLField<unknown, unknown>,
	args: readonly ArgumentNode[] | undefined,
): number {
	const sizes = cost.sizeArguments.map((name) =>
		argumentSize(
			cost,
			definition,
			name,
			args?.find((arg) => arg.name.value === name),
		),
	);
	const known = sizes.filter((size): size is number => size !== undefined);
	return known.length === 0 ? cost.defaultFirst : Math.max(...known);
}

/**
 * The size of the list `definition` returns on `parent`. On an interface the
 * object types' own fields count too (each may declare another default), the
 * largest size winning.
 */
export function listSize(
	cost: SizeContext,
	parent: GraphQLNamedType | undefined,
	definition: GraphQLField<unknown, unknown>,
	args: readonly ArgumentNode[] | undefined,
): number {
	const sizes = [sizeIn(cost, definition, args)];
	if (isAbstractType(parent)) {
		for (const type of cost.schema.getPossibleTypes(parent)) {
			const implemented = type.getFields()[definition.name];
			if (implemented) sizes.push(sizeIn(cost, implemented, args));
		}
	}
	return Math.max(...sizes);
}
