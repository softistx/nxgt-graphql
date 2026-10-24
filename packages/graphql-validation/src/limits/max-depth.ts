import {
	GraphQLError,
	type SelectionSetNode,
	type ValidationContext,
	type ValidationRule,
} from 'graphql';
import { assertInteger, operationLabel } from './describe';

/** Options of {@link maxDepth}. */
export interface MaxDepthOptions {
	/** The deepest nesting of field selections an operation may have (at least 1). */
	depth: number;
}

/**
 * A graphql-js validation rule refusing an operation nested deeper than
 * `depth` fields: a top-level field is depth 1.
 *
 * Named fragments are followed (each measured once), inline fragments add no
 * depth, and `__typename` and the introspection meta-fields (`__schema`,
 * `__type` and everything under them) do not count. One `GraphQLError` per
 * operation, with `extensions: { code: 'QUERY_TOO_DEEP', depth, limit }`,
 * `depth` being the operation's real depth.
 *
 * ```ts
 * validate(schema, document, [...specifiedRules, maxDepth({ depth: 8 })]);
 * // graphql-yoga: onValidate: ({ addValidationRule }) => addValidationRule(maxDepth({ depth: 8 }))
 * ```
 */
export function maxDepth({ depth: limit }: MaxDepthOptions): ValidationRule {
	assertInteger('maxDepth: depth', limit, 1);
	return (context: ValidationContext) => {
		const fragmentDepths = new Map<string, number>();
		const measuring = new Set<string>();

		const depthOf = (selectionSet: SelectionSetNode): number => {
			let deepest = 0;
			for (const selection of selectionSet.selections) {
				let depth = 0;
				if (selection.kind === 'Field') {
					if (selection.name.value.startsWith('__')) continue;
					depth =
						1 + (selection.selectionSet ? depthOf(selection.selectionSet) : 0);
				} else if (selection.kind === 'InlineFragment') {
					depth = depthOf(selection.selectionSet);
				} else {
					depth = fragmentDepth(selection.name.value);
				}
				if (depth > deepest) deepest = depth;
			}
			return deepest;
		};

		const fragmentDepth = (name: string): number => {
			const known = fragmentDepths.get(name);
			if (known !== undefined) return known;
			const fragment = context.getFragment(name);
			// A cycle is NoFragmentCyclesRule's to report; here it adds nothing.
			if (!fragment || measuring.has(name)) return 0;
			measuring.add(name);
			const depth = depthOf(fragment.selectionSet);
			measuring.delete(name);
			fragmentDepths.set(name, depth);
			return depth;
		};

		return {
			OperationDefinition(operation) {
				const depth = depthOf(operation.selectionSet);
				if (depth > limit) {
					context.reportError(
						new GraphQLError(
							`${operationLabel(operation)} is ${depth} levels deep, more than the ${limit} allowed`,
							{
								nodes: [operation],
								extensions: { code: 'QUERY_TOO_DEEP', depth, limit },
							},
						),
					);
				}
				return false;
			},
		};
	};
}
