import {
	type ASTNode,
	type DocumentNode,
	type FieldNode,
	Kind,
	print,
	type SelectionSetNode,
	visit,
} from 'graphql';
import type { Operation } from '../document';
import type { PersistedQueries } from '../persisted';

export const missingTypename =
	"With a cache, a persisted document needs __typename in every selection set: add the client preset's addTypenameSelectionDocumentTransform to its documentTransforms";

const typenameField: FieldNode = {
	kind: Kind.FIELD,
	name: { kind: Kind.NAME, value: '__typename' },
};

const typenamed = new WeakMap<DocumentNode, DocumentNode>();
const sent = new WeakMap<Operation, Operation>();

/**
 * The document with `__typename` added to every selection set but the
 * operation's own, where it is not already: a copy, cached per document.
 * The same document when nothing was missing.
 */
export function withTypename(node: DocumentNode): DocumentNode {
	let result = typenamed.get(node);
	if (!result) {
		result = visit(node, {
			SelectionSet(set: SelectionSetNode, _key, parent) {
				if (isOperation(parent) || hasTypename(set)) return undefined;
				return { ...set, selections: [...set.selections, typenameField] };
			},
		});
		typenamed.set(node, result);
	}
	return result;
}

/**
 * The operation a client with a cache sends: `__typename` added, so every
 * object can be identified. A subscription is sent as it is: its results
 * are not cached. In `documentId` mode the server holds the text, which
 * cannot change: the document must carry `__typename` already.
 */
export function cachedOperation(
	operation: Operation,
	persisted: PersistedQueries,
): Operation {
	if (operation.kind === 'subscription') return operation;
	const node = withTypename(operation.node);
	if (node === operation.node) return operation;
	if (persisted && persisted.mode === 'documentId')
		throw new TypeError(missingTypename);
	let result = sent.get(operation);
	if (!result) {
		result = { ...operation, query: print(node), node };
		sent.set(operation, result);
	}
	return result;
}

function hasTypename(set: SelectionSetNode): boolean {
	return set.selections.some(
		(selection) =>
			selection.kind === Kind.FIELD && selection.name.value === '__typename',
	);
}

function isOperation(
	parent: ASTNode | readonly ASTNode[] | undefined,
): boolean {
	return (
		parent !== undefined &&
		!Array.isArray(parent) &&
		(parent as ASTNode).kind === Kind.OPERATION_DEFINITION
	);
}
