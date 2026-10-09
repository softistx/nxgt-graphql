import {
	type FieldNode,
	type FragmentDefinitionNode,
	type GraphQLObjectType,
	type GraphQLSchema,
	isAbstractType,
	Kind,
	type SelectionNode,
	type SelectionSetNode,
} from 'graphql';

/** A selection set, and whether the response may leave it out. */
export interface Selected {
	readonly set: SelectionSetNode;
	readonly conditional: boolean;
}

/** A response key: its field, every node selecting it, if it may be absent. */
export interface Collected {
	readonly name: string;
	readonly nodes: { readonly node: FieldNode; readonly conditional: boolean }[];
	optional: boolean;
}

/** The directives that may leave a selection out of the response. */
const conditions = new Set(['skip', 'include', 'defer']);

/**
 * The fields `sets` select on `type`, by response key, as graphql's
 * CollectFields gathers them for every value of the variables: inline
 * fragments and spreads whose type condition `type` satisfies, the same
 * key's nodes merged, each node keeping whether it may be left out, so a
 * sub-field only a conditional node selects stays optional.
 */
export function collectFields(
	schema: GraphQLSchema,
	fragments: ReadonlyMap<string, FragmentDefinitionNode>,
	type: GraphQLObjectType,
	sets: readonly Selected[],
): Map<string, Collected> {
	const fields = new Map<string, Collected>();
	const applies = (condition: string): boolean => {
		const named = schema.getType(condition);
		if (!named) return false;
		if (named.name === type.name) return true;
		return isAbstractType(named) && schema.isSubType(named, type);
	};
	const visit = (
		set: SelectionSetNode,
		optional: boolean,
		seen: ReadonlySet<string>,
	): void => {
		for (const selection of set.selections) {
			const conditional = optional || isConditional(selection);
			if (selection.kind === Kind.FIELD) {
				const key = selection.alias?.value ?? selection.name.value;
				const entry = { node: selection, conditional };
				const field = fields.get(key);
				if (field) {
					field.nodes.push(entry);
					field.optional &&= conditional;
				} else
					fields.set(key, {
						name: selection.name.value,
						nodes: [entry],
						optional: conditional,
					});
			} else if (selection.kind === Kind.INLINE_FRAGMENT) {
				const condition = selection.typeCondition?.name.value;
				if (!condition || applies(condition))
					visit(selection.selectionSet, conditional, seen);
			} else {
				const name = selection.name.value;
				const fragment = fragments.get(name);
				if (
					fragment &&
					!seen.has(name) &&
					applies(fragment.typeCondition.name.value)
				)
					visit(fragment.selectionSet, conditional, new Set([...seen, name]));
			}
		}
	};
	for (const { set, conditional } of sets) visit(set, conditional, new Set());
	return fields;
}

function isConditional(selection: SelectionNode): boolean {
	return (selection.directives ?? []).some((directive) =>
		conditions.has(directive.name.value),
	);
}
