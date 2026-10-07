import type { GraphQLScalarType } from 'graphql';

/** The SDL that declares each scalar, with its `@specifiedBy` when it has one. */
export function typeDefsOf(scalars: Iterable<GraphQLScalarType>): string {
	return [...scalars]
		.map((scalar) =>
			scalar.specifiedByURL === null || scalar.specifiedByURL === undefined
				? `scalar ${scalar.name}`
				: `scalar ${scalar.name} @specifiedBy(url: "${scalar.specifiedByURL}")`,
		)
		.join('\n');
}
