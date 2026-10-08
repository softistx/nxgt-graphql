import {
	type GraphQLInputObjectType,
	type GraphQLSchema,
	getNamedType,
	isInputObjectType,
} from 'graphql';

/**
 * The input types that reach themselves through their fields, directly
 * (`Filter.and: [Filter]`) or through others: TypeScript cannot infer the
 * schema of such a type once a field wraps it, so the plugin writes their
 * types out.
 */
export function inputCycles(schema: GraphQLSchema): ReadonlySet<string> {
	const inputs = Object.values(schema.getTypeMap()).filter(isInputObjectType);
	const cyclic = new Set<string>();
	for (const start of inputs) {
		if (reaches(start, start.name, new Set())) cyclic.add(start.name);
	}
	return cyclic;
}

function reaches(
	from: GraphQLInputObjectType,
	target: string,
	seen: Set<string>,
): boolean {
	for (const field of Object.values(from.getFields())) {
		const named = getNamedType(field.type);
		if (!isInputObjectType(named)) continue;
		if (named.name === target) return true;
		if (seen.has(named.name)) continue;
		seen.add(named.name);
		if (reaches(named, target, seen)) return true;
	}
	return false;
}
