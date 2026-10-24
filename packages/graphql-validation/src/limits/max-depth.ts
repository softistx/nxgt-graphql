import {
	type FragmentDefinitionNode,
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

/** What a walk of one document needs: what it has measured so far. */
interface DepthContext {
	getFragment: (name: string) => FragmentDefinitionNode | null | undefined;
	fragmentDepths: Map<string, number>;
	measuring: Set<string>;
}

/** The depth of `selectionSet`: 0 when it selects no field. */
function depthOf(depth: DepthContext, selectionSet: SelectionSetNode): number {
	let deepest = 0;
	for (const selection of selectionSet.selections) {
		let here = 0;
		if (selection.kind === 'Field') {
			if (selection.name.value.startsWith('__')) continue;
			here =
				1 +
				(selection.selectionSet ? depthOf(depth, selection.selectionSet) : 0);
		} else if (selection.kind === 'InlineFragment') {
			here = depthOf(depth, selection.selectionSet);
		} else {
			here = fragmentDepth(depth, selection.name.value);
		}
		if (here > deepest) deepest = here;
	}
	return deepest;
}

/** The depth of the named fragment, measured once. */
function fragmentDepth(depth: DepthContext, name: string): number {
	const known = depth.fragmentDepths.get(name);
	if (known !== undefined) return known;
	const fragment = depth.getFragment(name);
	// A cycle is NoFragmentCyclesRule's to report; here it adds nothing.
	if (!fragment || depth.measuring.has(name)) return 0;
	depth.measuring.add(name);
	const result = depthOf(depth, fragment.selectionSet);
	depth.measuring.delete(name);
	depth.fragmentDepths.set(name, result);
	return result;
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
		const walk: DepthContext = {
			getFragment: (name) => context.getFragment(name),
			fragmentDepths: new Map(),
			measuring: new Set(),
		};
		return {
			OperationDefinition(operation) {
				const depth = depthOf(walk, operation.selectionSet);
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
