import type { ArgumentNode, GraphQLField, GraphQLNamedType } from 'graphql';
import { declaresSize, type SizeContext, statedSize } from './list-size';

/**
 * The size of the list `definition` on `parent`. `pending` is the size of the
 * field whose return type this list is selected on (a connection's `first`):
 * a list that declares none of the size arguments takes it, since the size
 * cannot be stated on the list itself. A list that declares one reads its own
 * arguments, else `defaultFirst`, and never the pending size.
 */
export function listSizeUnder(
	cost: SizeContext,
	parent: GraphQLNamedType | undefined,
	definition: GraphQLField<unknown, unknown>,
	args: readonly ArgumentNode[] | undefined,
	pending: number | undefined,
): number {
	if (pending !== undefined && !declaresSize(cost, parent, definition)) {
		return pending;
	}
	return statedSize(cost, parent, definition, args) ?? cost.defaultFirst;
}
