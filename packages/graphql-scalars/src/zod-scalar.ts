import {
	type ConstValueNode,
	GraphQLError,
	GraphQLScalarType,
	Kind,
	type ValueNode,
} from 'graphql';
import { z } from 'zod';

/** Which query literals a scalar reads: see {@link ZodScalarOptions.literals}. */
type Literals = 'leaf' | 'integer' | 'any';

export interface ZodScalarOptions<N extends string = string> {
	/** The GraphQL name, as the schema's `scalar` declaration spells it. */
	readonly name: N;
	readonly description?: string;
	/** The `@specifiedBy(url:)` of the format the scalar follows. */
	readonly specifiedByURL?: string;
	/**
	 * Which query literals the scalar reads. `'leaf'` (the default): a
	 * string, a number or a boolean. `'integer'`: the same but a float
	 * literal (`1.0`, `1e3`), refused as GraphQL's `Int` refuses it. A
	 * variable is JSON, where `1.0` is the number 1: no scalar can tell.
	 * `'any'`: every literal, objects and lists included, for a scalar that
	 * holds JSON. An enum value reads as its name. A variable inside the
	 * literal reads as graphql 17 reads it, on 16 as well: its value, or, when
	 * it is not given, an object field left out and a list item `null`. The
	 * schema sees the literal once with every variable left out (validation),
	 * then with their values. On graphql 16, a variable of a custom scalar
	 * arrives as its resolver value (a `Date`), on 17 as its wire value.
	 */
	readonly literals?: Literals;
}

/**
 * What {@link zodScalar} returns: a `GraphQLScalarType` whose GraphQL name is
 * known to the compiler, so a map of scalars can be keyed by it, and which
 * carries the schema it checks, with its exact type.
 */
export type ZodScalar<
	S extends z.ZodType = z.ZodType,
	N extends string = string,
> = GraphQLScalarType<z.output<S>, z.input<S>> & {
	readonly name: N;
	/**
	 * The schema every crossing is checked by: `z.decode` on a wire value
	 * gives what a resolver receives.
	 */
	readonly schema: S;
};

/**
 * A GraphQL scalar whose every crossing is checked by one Zod schema.
 *
 * - An input — a variable (`parseValue`) or a literal in the query
 *   (`parseLiteral`) — is **decoded**: what a resolver receives is
 *   `z.output<S>`.
 * - A resolver's return value is **encoded**: what goes on the wire is
 *   `z.input<S>`, checked on the way out as strictly as on the way in.
 *
 * A schema that changes the value on the way in must be a `z.codec`, so the
 * way out exists: a plain `.transform()` has no inverse, and Zod refuses to
 * encode through one. A schema that only validates needs nothing more.
 *
 * A refusal is a `GraphQLError` naming the scalar and Zod's first issue,
 * not the value: for the built-in scalars no issue contains it, so a
 * resolver's bad result does not reach the client in the error. A schema of
 * your own can still put input in its issue — a custom message, or a strict
 * object's `Unrecognized key`. graphql 16 also prefixes a bad *variable*'s
 * error with the value the client sent (`Variable "$e" got invalid value …`);
 * graphql 17 does not.
 */
export function zodScalar<S extends z.ZodType, const N extends string>(
	schema: S,
	options: ZodScalarOptions<N>,
): ZodScalar<S, N> {
	const { name } = options;
	/**
	 * Runs one direction of the schema. Zod *fails* on a value the schema
	 * refuses, and *throws* on what it cannot run: a `.transform()` on the way
	 * out (it has no inverse), an async check, or the caller's own codec
	 * throwing. Each becomes a `GraphQLError`, the original kept as its cause.
	 */
	const run = <T>(
		way: string,
		attempt: () => z.ZodSafeParseResult<T>,
		node?: ValueNode,
	): T => {
		const where = node === undefined ? {} : { nodes: node };
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
				...(cause === undefined ? {} : { originalError: cause }),
			});
		}
		if (result.success) return result.data;
		const issue = result.error.issues[0]?.message ?? 'invalid';
		throw new GraphQLError(`${name} cannot ${way}: ${issue}`, where);
	};
	const decode = (value: unknown, node?: ValueNode): z.output<S> =>
		run(
			'represent this input',
			() => z.safeDecode(schema, value as z.input<S>),
			node,
		);
	const encode = (value: unknown): z.input<S> =>
		run('serialize this value', () =>
			z.safeEncode(schema, value as z.output<S>),
		);
	const literals = options.literals ?? 'leaf';
	// graphql 16 passes the operation's variables, for a variable inside an
	// object or a list literal; graphql 17 substitutes them first.
	const literal = (node: ValueNode, variables?: Variables): z.output<S> =>
		decode(readLiteral(node, name, literals, variables), node);

	// graphql 16 knows only the first three; graphql 17 also takes the
	// `coerce*` ones, and marks the first three deprecated, to be removed in
	// 18. Both sets are the same functions, so whichever a version calls
	// behaves the same. They are passed from a variable rather than a literal
	// so that graphql 16's config type does not refuse the names it lacks.
	const config = {
		name,
		description: options.description,
		specifiedByURL: options.specifiedByURL,
		serialize: encode,
		parseValue: (value: unknown) => decode(value),
		parseLiteral: literal,
		coerceOutputValue: encode,
		coerceInputValue: (value: unknown) => decode(value),
		coerceInputLiteral: (node: ConstValueNode) => literal(node),
	};
	return Object.assign(new GraphQLScalarType<z.output<S>, z.input<S>>(config), {
		schema,
	}) as ZodScalar<S, N>;
}

/** An operation's variables, as graphql 16 passes them to `parseLiteral`. */
type Variables = { readonly [name: string]: unknown } | null;

/** The JavaScript value of a literal, as the scalar's `literals` reads it. */
function readLiteral(
	node: ValueNode,
	name: string,
	literals: Literals,
	variables: Variables | undefined,
): unknown {
	return literals === 'any'
		? untypedValue(node, variables ?? null)
		: literalValue(node, name, literals);
}

/**
 * Any literal as a JSON value, a variable inside it as graphql 17's
 * `replaceVariables` substitutes it: an object field whose variable is not
 * given is left out, a list item `null`. Without variables (graphql 16's
 * validation pass), every one is not given, as graphql 17's validation sees
 * it.
 */
function untypedValue(node: ValueNode, variables: Variables): unknown {
	switch (node.kind) {
		case Kind.NULL:
			return null;
		case Kind.INT:
		case Kind.FLOAT:
			return Number(node.value);
		case Kind.STRING:
		case Kind.ENUM:
		case Kind.BOOLEAN:
			return node.value;
		case Kind.LIST:
			return node.values.map((item) => untypedValue(item, variables) ?? null);
		case Kind.OBJECT: {
			const object: Record<string, unknown> = {};
			for (const field of node.fields) {
				const value = untypedValue(field.value, variables);
				if (value !== undefined) object[field.name.value] = value;
			}
			return object;
		}
		case Kind.VARIABLE:
			return variables?.[node.name.value];
	}
}

/**
 * The JavaScript value of a literal, before the schema sees it: a string,
 * a number or a boolean. Anything else — an enum, a list, an object, a
 * variable — is refused here, since none of them is what a leaf scalar
 * reads; so is a float literal for an integer scalar.
 */
function literalValue(
	node: ValueNode,
	name: string,
	literals: Exclude<Literals, 'any'>,
): unknown {
	switch (node.kind) {
		case Kind.STRING:
			return node.value;
		case Kind.INT:
			return Number(node.value);
		case Kind.FLOAT:
			if (literals === 'integer') break;
			return Number(node.value);
		case Kind.BOOLEAN:
			return node.value;
	}
	throw new GraphQLError(`${name} cannot represent a ${node.kind} literal`, {
		nodes: node,
	});
}
