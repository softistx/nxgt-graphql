import type { ArgumentNode, GraphQLField, GraphQLNamedType } from 'graphql';
import { declaration, type SizeContext, statedSize } from './list-size';

/**
 * The size of the list `definition` on `parent`. `pending` is the size of the
 * field whose return type this list is selected on (a connection's `first`):
 * a list that declares none of the size arguments takes it, since the size
 * cannot be stated on the list itself. A list that declares one reads its own
 * arguments, else `defaultFirst`, and never the pending size. On an abstract
 * parent some possible types may declare one and others not: the largest of
 * both readings, since the query cannot say which comes back.
 */
export function listSizeUnder(
	cost: SizeContext,
	parent: GraphQLNamedType | undefined,
	definition: GraphQLField<unknown, unknown>,
	args: readonly ArgumentNode[] | undefined,
	pending: number | undefined,
): number {
	const own = () =>
		statedSize(cost, parent, definition, args) ?? cost.defaultFirst;
	if (pending === undefined) return own();
	const declared = declaration(cost, parent, definition);
	if (declared === 'none') return pending;
	if (declared === 'all') return own();
	// Mixed: a possible type declaring none takes the pending size, another reads its own.
	return Math.max(pending, own());
}
