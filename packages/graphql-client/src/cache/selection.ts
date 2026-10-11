import {
	type DocumentNode,
	type FieldNode,
	type FragmentDefinitionNode,
	Kind,
	type OperationDefinitionNode,
	type SelectionNode,
	type SelectionSetNode,
	valueFromASTUntyped,
} from 'graphql';
import type { Variables } from './field-key';
import type { TypeMatcher } from './type-match';

/** A document as the cache walks it: its operation, its fragments, its root entity. */
export interface CacheDocument {
	readonly operation: OperationDefinitionNode;
	readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>;
	/** `ROOT_QUERY`, `ROOT_MUTATION` or `ROOT_SUBSCRIPTION`. */
	readonly rootKey: string;
}

/** One walk of a document: the variables, defaults applied, and the type matcher. */
export interface Walk {
	readonly document: CacheDocument;
	readonly variables: Variables;
	readonly matches: TypeMatcher;
}

/** The fields to visit on one object, by response key (alias or name). */
export interface Collected {
	readonly fields: Map<string, FieldNode[]>;
	/** Fragments whose type condition could not be decided: read only when whole. */
	readonly undecided: SelectionSetNode[];
}

const documents = new WeakMap<DocumentNode, CacheDocument>();

export function cacheDocumentOf(node: DocumentNode): CacheDocument {
	let document = documents.get(node);
	if (document) return document;
	const operation = node.definitions.find(
		(definition) => definition.kind === Kind.OPERATION_DEFINITION,
	);
	if (!operation) throw new TypeError('The document holds no operation');
	const fragments = new Map<string, FragmentDefinitionNode>();
	for (const definition of node.definitions)
		if (definition.kind === Kind.FRAGMENT_DEFINITION)
			fragments.set(definition.name.value, definition);
	const rootKey = `ROOT_${operation.operation.toUpperCase()}`;
	document = { operation, fragments, rootKey };
	documents.set(node, document);
	return document;
}

/** The variables given, each one left out taking its declared default. */
export function variablesOf(
	operation: OperationDefinitionNode,
	given: unknown,
): Variables {
	const variables: Record<string, unknown> = {
		...(given as Record<string, unknown> | undefined),
	};
	for (const definition of operation.variableDefinitions ?? []) {
		const name = definition.variable.name.value;
		if (variables[name] === undefined && definition.defaultValue)
			variables[name] = valueFromASTUntyped(definition.defaultValue);
	}
	return variables;
}

/**
 * The fields the selection sets ask of an object of `typename`: `@skip`
 * and `@include` applied, fragments matched, same response keys grouped.
 * With `undecidedApply`, an undecided fragment's fields join the others.
 */
export function collectFields(
	sets: readonly SelectionSetNode[],
	typename: string | undefined,
	walk: Walk,
	undecidedApply: boolean,
): Collected {
	const collected: Collected = { fields: new Map(), undecided: [] };
	const seen = new Set<string>();
	const visit = (set: SelectionSetNode) => {
		for (const selection of set.selections) {
			if (!included(selection, walk.variables)) continue;
			if (selection.kind === Kind.FIELD) {
				const key = selection.alias?.value ?? selection.name.value;
				const group = collected.fields.get(key);
				if (group) group.push(selection);
				else collected.fields.set(key, [selection]);
				continue;
			}
			const fragment = fragmentOf(selection, walk, seen);
			if (!fragment) continue;
			const match = walk.matches(fragment.condition, typename);
			if (match || (match === undefined && undecidedApply)) visit(fragment.set);
			else if (match === undefined) collected.undecided.push(fragment.set);
		}
	};
	for (const set of sets) visit(set);
	return collected;
}

/** The sub-selections of fields grouped under one response key. */
export function subSelections(
	fields: readonly FieldNode[],
): SelectionSetNode[] {
	return fields.flatMap((field) =>
		field.selectionSet ? [field.selectionSet] : [],
	);
}

function fragmentOf(
	selection: Exclude<SelectionNode, FieldNode>,
	walk: Walk,
	seen: Set<string>,
): { condition: string | undefined; set: SelectionSetNode } | undefined {
	if (selection.kind === Kind.INLINE_FRAGMENT)
		return {
			condition: selection.typeCondition?.name.value,
			set: selection.selectionSet,
		};
	const name = selection.name.value;
	if (seen.has(name)) return undefined;
	seen.add(name);
	const definition = walk.document.fragments.get(name);
	if (!definition) throw new TypeError(`The document has no fragment ${name}`);
	return {
		condition: definition.typeCondition.name.value,
		set: definition.selectionSet,
	};
}

/** `@skip(if:)` and `@include(if:)`, read from the variables. */
function included(selection: SelectionNode, variables: Variables): boolean {
	for (const directive of selection.directives ?? []) {
		const name = directive.name.value;
		if (name !== 'skip' && name !== 'include') continue;
		const argument = directive.arguments?.find(
			(arg) => arg.name.value === 'if',
		);
		const value = argument
			? valueFromASTUntyped(argument.value, variables)
			: undefined;
		if (name === 'skip' && value === true) return false;
		if (name === 'include' && value !== true) return false;
	}
	return true;
}
