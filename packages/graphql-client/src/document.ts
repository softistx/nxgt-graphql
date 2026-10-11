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

/**
 * An operation ready to send: its text, its name when it has one, and the
 * hash the client preset's `persistedDocuments` wrote, when it did.
 */
export interface Operation {
	readonly query: string;
	readonly operationName: string | undefined;
	readonly kind: 'query' | 'mutation' | 'subscription';
	/** `__meta__.hash`: on the `DocumentNode`, or on the `TypedDocumentString`. */
	readonly hash?: string;
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
		operation = withHash(readObject(document), document);
		operations.set(document, operation);
	}
	return operation;
}

/** The preset's `persistedDocuments` puts `__meta__: { hash }` on each operation. */
function withHash(operation: Operation, document: object): Operation {
	const meta = (document as { __meta__?: unknown }).__meta__;
	const hash =
		typeof meta === 'object' && meta !== null
			? (meta as { hash?: unknown }).hash
			: undefined;
	return typeof hash === 'string' ? { ...operation, hash } : operation;
}

function readObject(document: object): Operation {
	if (isDocumentNode(document)) return fromNode(document);
	// A `TypedDocumentString`; anything else, such as the preset's hash-only
	// `replaceDocumentWithHash` object, holds no text to read.
	if (document instanceof String) return fromText(String(document));
	throw new TypeError('The document holds no operation');
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
