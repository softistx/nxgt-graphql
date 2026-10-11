import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
import { type DocumentNode, Kind, parse, print } from 'graphql';

/**
 * What the client preset writes for an operation: a `TypedDocumentNode`
 * (`documentMode: 'documentNode'`, its default) or a `TypedDocumentString`
 * (`documentMode: 'string'`). Both carry the result and variables types.
 */
export type GraphQLDocument<TResult, TVariables> = DocumentTypeDecoration<
	TResult,
	TVariables
>;

/** An operation ready to send: its text, and its name when it has one. */
export interface Operation {
	readonly query: string;
	readonly operationName: string | undefined;
	readonly kind: 'query' | 'mutation' | 'subscription';
}

const operations = new WeakMap<object, Operation>();
const textOperations = new Map<string, Operation>();

/** Reads a document once: a preset's documents are module constants. */
export function operationOf(
	document: GraphQLDocument<unknown, never>,
): Operation {
	if (typeof document === 'string') {
		let operation = textOperations.get(document);
		if (!operation) {
			operation = fromText(document);
			textOperations.set(document, operation);
		}
		return operation;
	}
	let operation = operations.get(document);
	if (!operation) {
		operation = isDocumentNode(document)
			? fromNode(document)
			: fromText(String(document));
		operations.set(document, operation);
	}
	return operation;
}

function isDocumentNode(document: unknown): document is DocumentNode {
	return (document as DocumentNode).kind === Kind.DOCUMENT;
}

function fromNode(document: DocumentNode): Operation {
	const definition = document.definitions.find(
		(node) => node.kind === Kind.OPERATION_DEFINITION,
	);
	if (!definition) throw new TypeError('The document holds no operation');
	return {
		query: print(document),
		operationName: definition.name?.value,
		kind: definition.operation as Operation['kind'],
	};
}

/** A `TypedDocumentString`: sent as written, parsed only to find the operation. */
function fromText(query: string): Operation {
	return { ...fromNode(parse(query, { noLocation: true })), query };
}
