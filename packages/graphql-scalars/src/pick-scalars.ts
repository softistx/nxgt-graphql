import type { GraphQLScalarType } from 'graphql';
import {
	type ScalarName,
	type ScalarResolvers,
	scalarResolvers,
} from './scalars';
import { typeDefsOf } from './type-defs';

/**
 * Some of the scalars, for a schema-first server: the SDL that declares
 * them and the `resolvers` entries that bind them, and nothing else. The
 * names are checked by the compiler, and again when it runs.
 */
export function pickScalars<const N extends readonly ScalarName[]>(
	...names: N
): {
	readonly typeDefs: string;
	readonly resolvers: Pick<ScalarResolvers, N[number]>;
} {
	const known: Record<string, GraphQLScalarType | undefined> = scalarResolvers;
	const resolvers: Record<string, GraphQLScalarType> = {};
	for (const name of names) {
		// Own keys only: `toString` or `constructor` from an untyped caller (the
		// bin's argv) would otherwise read `Object.prototype`.
		const scalar = Object.hasOwn(known, name) ? known[name] : undefined;
		if (scalar === undefined) {
			throw new TypeError(
				`pickScalars: no scalar is named ${JSON.stringify(name)}. The names are ${Object.keys(known).join(', ')}.`,
			);
		}
		resolvers[name] = scalar;
	}
	return {
		typeDefs: typeDefsOf(Object.values(resolvers)),
		resolvers: resolvers as Pick<ScalarResolvers, N[number]>,
	};
}
