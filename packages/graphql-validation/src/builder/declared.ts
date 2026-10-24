import {
	type GraphQLField,
	type GraphQLInputType,
	getNamedType,
	isInputObjectType,
	isListType,
	isNonNullType,
} from 'graphql';
import { type Constraint, constraintsOn } from './constraints';
import type { InputSchemas } from './input-schema';

/**
 * The `@constraint` arguments written where a Zod issue's `path` points, in
 * a field's arguments: the argument or input field it ends on, or, under a
 * list, the list's own rules (`minItems`, `maxItems`) at the list and its
 * items' at an index, as `InputSchemas` splits them. Empty when the path
 * leaves the declared types.
 */
export function declaredAt(
	inputs: InputSchemas,
	field: GraphQLField<unknown, unknown>,
	path: readonly PropertyKey[],
): readonly Constraint[] {
	const [name, ...rest] = path;
	const arg = field.args.find((candidate) => candidate.name === name);
	if (!arg) return [];
	let type: GraphQLInputType = arg.type;
	let constraints = constraintsOn(inputs.directive, arg.astNode);
	for (const key of rest) {
		const unwrapped = isNonNullType(type) ? type.ofType : type;
		if (isListType(unwrapped) && typeof key === 'number') {
			constraints = constraints.filter(({ rule }) => rule.target !== 'list');
			type = unwrapped.ofType;
			continue;
		}
		const named = getNamedType(unwrapped);
		const next =
			!isListType(unwrapped) && isInputObjectType(named)
				? named.getFields()[String(key)]
				: undefined;
		if (!next) return [];
		type = next.type;
		constraints = constraintsOn(inputs.directive, next.astNode);
	}
	// Ending on a list: its own rules; an item or a leaf: the rest.
	const onList = isListType(isNonNullType(type) ? type.ofType : type);
	return constraints.filter(({ rule }) => (rule.target === 'list') === onList);
}
