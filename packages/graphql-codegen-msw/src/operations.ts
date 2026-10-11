import { Kind, type OperationDefinitionNode } from 'graphql';
import type { DocumentFile } from './config';
import type { MockedKind } from './naming';

/** A named query or mutation of the documents. */
export interface MockedOperationNode {
	readonly name: string;
	readonly kind: MockedKind;
	readonly node: OperationDefinitionNode;
}

/**
 * Every named query and mutation, in document order. An anonymous
 * operation has no name for msw to match, and a subscription is not an
 * HTTP request msw's `query` or `mutation` handler answers: neither gets a
 * handler.
 */
export function mockedOperations(
	documents: readonly DocumentFile[],
): MockedOperationNode[] {
	return documents
		.flatMap((file) => file.document?.definitions ?? [])
		.filter(
			(node): node is OperationDefinitionNode =>
				node.kind === Kind.OPERATION_DEFINITION,
		)
		.flatMap((node) => {
			const name = node.name?.value;
			const kind: string = node.operation;
			if (!name || (kind !== 'query' && kind !== 'mutation')) return [];
			return [{ name, kind: kind as MockedKind, node }];
		});
}
