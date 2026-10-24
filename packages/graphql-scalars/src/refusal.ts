import { GraphQLError, type ValueNode } from 'graphql';
import { z } from 'zod';

/**
 * The `extensions` of every refusal of an input, for a server to map to its
 * own error without parsing the message.
 */
export type InvalidScalarExtensions = {
	readonly code: 'INVALID_SCALAR';
	/** The GraphQL name of the scalar that refused. */
	readonly scalar: string;
	/**
	 * Why: Zod's first issue `code` (`invalid_format`, `too_small`,
	 * `invalid_type`, `custom`…), or `invalid_type` for a literal of a kind
	 * the scalar does not read. Absent when the schema threw instead of
	 * failing (a codec's own error, an async check).
	 */
	readonly reason?: string;
};

export function refusalExtensions(
	scalar: string,
	reason?: string,
): InvalidScalarExtensions {
	return {
		code: 'INVALID_SCALAR',
		scalar,
		...(reason === undefined ? {} : { reason }),
	};
}

/**
 * Runs one direction of a scalar's schema. Zod *fails* on a value the schema
 * refuses, and *throws* on what it cannot run: a `.transform()` on the way
 * out (it has no inverse), an async check, or the caller's own codec
 * throwing. Each becomes a `GraphQLError`, the original kept as its cause;
 * an `input` refusal also carries {@link InvalidScalarExtensions}.
 */
export function run<T>(
	name: string,
	way: string,
	attempt: () => z.ZodSafeParseResult<T>,
	{
		input,
		node,
	}: { readonly input: boolean; readonly node?: ValueNode | undefined },
): T {
	const where = node === undefined ? {} : { nodes: node };
	const extensions = (reason?: string) =>
		input ? { extensions: refusalExtensions(name, reason) } : {};
	let result: z.ZodSafeParseResult<T>;
	try {
		result = attempt();
	} catch (error) {
		const cause = error instanceof Error ? error : undefined;
		const why =
			error instanceof z.core.$ZodEncodeError
				? ': its schema transforms with no way back, use z.codec'
				: '';
		throw new GraphQLError(`${name} cannot ${way}${why}`, {
			...where,
			...extensions(),
			...(cause === undefined ? {} : { originalError: cause }),
		});
	}
	if (result.success) return result.data;
	const first = result.error.issues[0];
	throw new GraphQLError(
		`${name} cannot ${way}: ${first?.message ?? 'invalid'}`,
		{ ...where, ...extensions(first?.code ?? 'custom') },
	);
}
