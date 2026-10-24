import {
	type ArgumentNode,
	type GraphQLField,
	type GraphQLNamedType,
	type GraphQLSchema,
	isAbstractType,
} from 'graphql';
import { constraintMaxOf, defaultSizeOf, literalSize } from './size-reading';

/** What sizing a list needs: the schema and the options of the rule. */
export interface SizeContext {
	schema: GraphQLSchema;
	sizeArguments: readonly string[];
	defaultFirst: number;
	/** What to assume for a size argument given as a variable when it declares no `@constraint(max)`. */
	variableSize?: number | undefined;
}

/**
 * What the schema alone says of one list field and the fields implementing it,
 * per size argument (in `sizeArguments` order): the largest default, whether
 * some definition has none, and whether some definition has no default at all.
 */
interface Profile {
	largest: (number | undefined)[];
	/** Per size argument, the largest `@constraint(max)` over the definitions. */
	maxima: (number | undefined)[];
	/** Per size argument, whether some definition declares no max. */
	someNoMax: boolean[];
	someLack: boolean[];
	someBare: boolean;
	/** Whether some definition declares any of the size arguments. */
	declares: boolean;
	/** Whether some definition declares none of them. */
	someUndeclared: boolean;
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
		maxima: cost.sizeArguments.map(() => undefined),
		someNoMax: cost.sizeArguments.map(() => false),
		someLack: cost.sizeArguments.map(() => false),
		someBare: false,
		declares: false,
		someUndeclared: false,
	};
	for (const field of definitions) {
		let any = false;
		cost.sizeArguments.forEach((name, index) => {
			const argument = field.args.find((arg) => arg.name === name);
			const max = constraintMaxOf(argument);
			if (max === undefined) profile.someNoMax[index] = true;
			else profile.maxima[index] = Math.max(profile.maxima[index] ?? 0, max);
			const size = defaultSizeOf(argument);
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
		} else {
			profile.someUndeclared = true;
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
	// default, else defaultFirst; and no less than what the client may send.
	const today = profile.someLack[index]
		? Math.max(largest ?? 0, cost.defaultFirst)
		: largest;
	const bound = unusableBound(cost, profile, index);
	return bound === undefined ? today : Math.max(today ?? 0, bound);
}

/** What an unusable size may be at most: the declared max, `variableSize` where none is declared. */
function unusableBound(
	cost: SizeContext,
	profile: Profile,
	index: number,
): number | undefined {
	const assumed = profile.someNoMax[index] ? cost.variableSize : undefined;
	const declared = profile.maxima[index];
	if (assumed === undefined) return declared;
	return Math.max(declared ?? 0, assumed);
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

/**
 * Whether `definition` and the fields implementing it declare a size argument:
 * `'all'` of them, `'none'` of them, or `'some'` (an abstract parent whose
 * possible types differ).
 */
export function declaration(
	cost: SizeContext,
	parent: GraphQLNamedType | undefined,
	definition: GraphQLField<unknown, unknown>,
): 'all' | 'none' | 'some' {
	const { declares, someUndeclared } = profileOf(cost, parent, definition);
	if (!declares) return 'none';
	return someUndeclared ? 'some' : 'all';
}
