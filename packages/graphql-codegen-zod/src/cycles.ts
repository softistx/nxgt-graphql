import {
	type GraphQLNamedType,
	type GraphQLSchema,
	getNamedType,
	isAbstractType,
	isInputObjectType,
	isInterfaceType,
	isObjectType,
} from 'graphql';

/**
 * The input types that reach themselves through their fields, directly
 * (`Filter.and: [Filter]`) or through others: TypeScript cannot infer the
 * schema of such a type once a field wraps it, so the plugin writes their
 * types out.
 */
export function inputCycles(schema: GraphQLSchema): ReadonlySet<string> {
	return cycles(
		Object.values(schema.getTypeMap()).filter(isInputObjectType),
		(type) =>
			isInputObjectType(type)
				? Object.values(type.getFields())
						.map((field) => getNamedType(field.type))
						.filter(isInputObjectType)
				: [],
	);
}

/**
 * The object types that reach themselves through their fields, an
 * interface's or a union's members included: TypeScript infers such a
 * schema only so deep (TS2589 past a loop of ten), so the plugin writes
 * their types out.
 */
export function outputCycles(schema: GraphQLSchema): ReadonlySet<string> {
	return cycles(
		Object.values(schema.getTypeMap()).filter(
			(type) => isObjectType(type) && !type.name.startsWith('__'),
		),
		(type) => {
			if (isAbstractType(type)) return schema.getPossibleTypes(type);
			if (!isObjectType(type) && !isInterfaceType(type)) return [];
			return Object.values(type.getFields())
				.map((field) => getNamedType(field.type))
				.filter((named) => isObjectType(named) || isAbstractType(named));
		},
	);
}

function cycles(
	starts: readonly GraphQLNamedType[],
	next: (type: GraphQLNamedType) => readonly GraphQLNamedType[],
): ReadonlySet<string> {
	const reaches = (
		from: GraphQLNamedType,
		target: string,
		seen: Set<string>,
	): boolean =>
		next(from).some((named) => {
			if (named.name === target) return true;
			if (seen.has(named.name)) return false;
			seen.add(named.name);
			return reaches(named, target, seen);
		});
	return new Set(
		starts
			.filter((start) => reaches(start, start.name, new Set()))
			.map((start) => start.name),
	);
}
