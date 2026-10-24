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

const CANONICAL_INTEGER = /^(0|[1-9]\d*)$/;

/**
 * The one reading of a size, wherever it comes from (a literal, a default): a
 * non-negative integral number or bigint, or a canonical-integer string,
 * clamped to the ceiling. Anything else says nothing.
 */
function sizeOf(value: unknown): number | undefined {
	if (typeof value === 'string') {
		return CANONICAL_INTEGER.test(value)
			? Math.min(Number(value), CEILING)
			: undefined;
	}
	// A bigint is how a Long scalar's default is held once its real scalar is
	// swapped in.
	if (typeof value === 'bigint') {
		return value >= 0n ? Math.min(Number(value), CEILING) : undefined;
	}
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
		? Math.min(value, CEILING)
		: undefined;
}

/** The size a literal gives: an Int, a canonical-integer String or an integral Float (`1e3`). */
function literalSize(value: ValueNode): number | undefined {
	if (value.kind === 'IntValue' || value.kind === 'FloatValue') {
		return sizeOf(Number(value.value));
	}
	return value.kind === 'StringValue' ? sizeOf(value.value) : undefined;
}

/**
 * An argument's SDL default as a size. graphql 16 holds it as `defaultValue`;
 * graphql 17 as `default`, `{ value }` or `{ literal }`.
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
	if ('literal' in fallback && typeof fallback.literal === 'object') {
		const literal = fallback.literal;
		return literal !== null && 'kind' in literal
			? literalSize(literal as ValueNode)
			: undefined;
	}
	return undefined;
}

/**
 * What the schema alone says of one list field and the fields implementing it,
 * per size argument (in `sizeArguments` order): the largest default, whether
 * some definition has none, and whether some definition has no default at all.
 */
interface Profile {
	largest: (number | undefined)[];
	someLack: boolean[];
	someBare: boolean;
	/** Whether some definition declares any of the size arguments. */
	declares: boolean;
}

const profiles = new WeakMap<
	GraphQLSchema,
	WeakMap<readonly string[], Map<string, Profile>>
>();

function profileOf(
	cost: SizeContext,
	parent: GraphQLNamedType | undefined,
	definition: GraphQLField<unknown, unknown>,
): Profile {
	let bySizes = profiles.get(cost.schema);
	if (!bySizes) {
		bySizes = new WeakMap();
		profiles.set(cost.schema, bySizes);
	}
	let byField = bySizes.get(cost.sizeArguments);
	if (!byField) {
		byField = new Map();
		bySizes.set(cost.sizeArguments, byField);
	}
	const key = `${parent?.name}.${definition.name}`;
	const known = byField.get(key);
	if (known) return known;

	// On an interface the object types' own fields count too: each may
	// declare another default, and the query cannot say which comes back.
	const definitions = [definition];
	if (isAbstractType(parent)) {
		for (const type of cost.schema.getPossibleTypes(parent)) {
			const implemented = type.getFields()[definition.name];
			if (implemented) definitions.push(implemented);
		}
	}
	const profile: Profile = {
		largest: cost.sizeArguments.map(() => undefined),
		someLack: cost.sizeArguments.map(() => false),
		someBare: false,
		declares: false,
	};
	for (const field of definitions) {
		let any = false;
		cost.sizeArguments.forEach((name, index) => {
			const size = defaultSizeOf(field.args.find((arg) => arg.name === name));
			if (size === undefined) {
				profile.someLack[index] = true;
				return;
			}
			any = true;
			profile.largest[index] = Math.max(profile.largest[index] ?? 0, size);
		});
		if (!any) profile.someBare = true;
		if (field.args.some((arg) => cost.sizeArguments.includes(arg.name))) {
			profile.declares = true;
		}
	}
	byField.set(key, profile);
	return profile;
}

/** The size a size argument says, `undefined` when it says nothing. */
function argumentSize(
	cost: SizeContext,
	profile: Profile,
	index: number,
	node: ArgumentNode | undefined,
): number | undefined {
	const largest = profile.largest[index];
	if (!node) return largest;
	const literal = literalSize(node.value);
	if (literal !== undefined) return literal;
	// Given but unusable (a variable, a negative number): the argument's own
	// default, else defaultFirst.
	return profile.someLack[index]
		? Math.max(largest ?? 0, cost.defaultFirst)
		: largest;
}

/**
 * The size `definition` states on `parent`, as selected by `args`: the largest
 * its size arguments say, `undefined` when none says anything (none given, and
 * none declared with a default). The schema's part is memoized, so a selection
 * costs `sizeArguments.length` steps whatever the number of possible types.
 * A list uses it, and a field returning an object (a Relay connection) hands it
 * to the lists below it.
 */
export function statedSize(
	cost: SizeContext,
	parent: GraphQLNamedType | undefined,
	definition: GraphQLField<unknown, unknown>,
	args: readonly ArgumentNode[] | undefined,
): number | undefined {
	const profile = profileOf(cost, parent, definition);
	let size: number | undefined;
	let given = false;
	cost.sizeArguments.forEach((name, index) => {
		const node = args?.find((arg) => arg.name.value === name);
		if (node) given = true;
		const said = argumentSize(cost, profile, index, node);
		if (said !== undefined) size = Math.max(size ?? 0, said);
	});
	// Nothing given: a definition without any default is sized defaultFirst.
	if (size !== undefined && !given && profile.someBare) {
		return Math.max(size, cost.defaultFirst);
	}
	return size;
}

/** Whether `definition` (or, on an abstract parent, a possible type's field) declares a size argument. */
export function declaresSize(
	cost: SizeContext,
	parent: GraphQLNamedType | undefined,
	definition: GraphQLField<unknown, unknown>,
): boolean {
	return profileOf(cost, parent, definition).declares;
}
