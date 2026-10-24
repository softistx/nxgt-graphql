import {
	type GraphQLField,
	type GraphQLNamedType,
	type GraphQLSchema,
	isEnumType,
	isInputObjectType,
	isInterfaceType,
	isObjectType,
	isUnionType,
	SchemaMetaFieldDef,
	TypeMetaFieldDef,
} from 'graphql';

/** The meta-fields that read the schema; `__typename` is not one. */
export function isIntrospectionRoot(name: string): boolean {
	return name === '__schema' || name === '__type';
}

/** The definition of `__schema` or `__type`, selected on the query root. */
export function introspectionRoot(
	name: string,
): GraphQLField<unknown, unknown> | undefined {
	if (name === '__schema') return SchemaMetaFieldDef;
	if (name === '__type') return TypeMetaFieldDef;
	return undefined;
}

/** The largest list the introspection types can return for `schema`, by schema. */
const largest = new WeakMap<GraphQLSchema, number>();

function largestCount(schema: GraphQLSchema): number {
	const known = largest.get(schema);
	if (known !== undefined) return known;
	let max = schema.getDirectives().length;
	for (const directive of schema.getDirectives()) {
		max = Math.max(max, directive.args.length, directive.locations.length);
	}
	for (const type of Object.values(schema.getTypeMap())) {
		max = Math.max(max, countsOf(schema, type));
	}
	largest.set(schema, max);
	return max;
}

/** The longest of a type's fields, input fields, enum values, interfaces, possible types and arguments. */
function countsOf(schema: GraphQLSchema, type: GraphQLNamedType): number {
	if (isObjectType(type) || isInterfaceType(type)) {
		const fields = Object.values(type.getFields());
		return Math.max(
			fields.length,
			type.getInterfaces().length,
			isInterfaceType(type) ? schema.getPossibleTypes(type).length : 0,
			...fields.map((field) => field.args.length),
		);
	}
	if (isInputObjectType(type)) return Object.keys(type.getFields()).length;
	if (isEnumType(type)) return type.getValues().length;
	if (isUnionType(type)) return type.getTypes().length;
	return 0;
}

/**
 * The most items the introspection list `parent.field` can hold in `schema`:
 * the number of types for `__Schema.types`, else the largest list anywhere in
 * the schema. Not `defaultFirst`: a query asks no size of them.
 */
export function introspectionSize(
	schema: GraphQLSchema,
	field: string,
): number {
	return field === 'types'
		? Object.keys(schema.getTypeMap()).length
		: largestCount(schema);
}
