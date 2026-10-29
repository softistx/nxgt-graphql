import { Kind, type OperationDefinitionNode } from 'graphql';
import type { DocumentFile } from './config';
import type { MockedKind } from './naming';

/** A named query, mutation or subscription of the documents. */
export interface MockedOperationNode {
	readonly name: string;
	readonly kind: MockedKind;
	readonly node: OperationDefinitionNode;
}

/**
 * Every named operation, in document order. An anonymous operation has no
 * name to match: it gets no handler.
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
			const kind = node.operation;
			if (!name) return [];
			return [{ name, kind: kind as MockedKind, node }];
		});
}
