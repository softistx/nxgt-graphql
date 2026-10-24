// What graphql-yoga refuses while it coerces the variables, before any
// resolver runs: a missing or null value for a non-null type, a value of the
// wrong type, an unknown enum value, an unknown input field, an Int beyond
// 32 bits, a value a custom scalar refuses. Measured on graphql-yoga 5.24
// (@graphql-tools/executor 2, graphql 17): one error per problem,
// `{ message, locations }`, status 400 whatever the Accept header. Only a
// custom scalar's refusal has `extensions`: the `INVALID_SCALAR` ones
// `zodScalar` puts in its error, which graphql keeps on the variable's.
//
// How coercion is decided: the variables are walked as graphql walks them
// (`validate.ts`), over the input types the generated file describes from
// the schema. A built-in scalar, an enum, an input object and the non-null
// and list wrappers are judged as graphql judges them, from the declared
// type and the value sent, never from a Zod issue; a custom scalar refuses
// exactly where the operation's Zod schema has an issue at its position.
// So the answer is graphql-yoga's whenever graphql would refuse, and empty
// otherwise, when the issues are the API's own validation.
import type { GraphQLFormattedError, VariableDefinitionNode } from 'graphql';
import { GraphQLError } from 'graphql';
import type { z } from 'zod';
import {
	declared,
	definitionsOf,
	type InputTypes,
	printType,
} from './document';
import { placed } from './issues';
import { variableRefusal } from './messages';
import { type Problem, validateValue, type Walk } from './validate';

export type { InputType, InputTypes } from './document';
export { STALE_FILE } from './validate';

/** The status graphql-yoga answers a variable coercion error with. */
export const COERCION_STATUS = 400;

/**
 * What the generated file says of an operation's variables. Without them
 * (a hand-written handler), no variable is walked.
 */
export interface DeclaredVariables {
	/** Each variable's type, with its default: `{ first: "Int = 10" }`. */
	readonly variableTypes?: Readonly<Record<string, string>> | undefined;
	readonly inputTypes?: InputTypes | undefined;
}

/** The request whose variables the operation's schema refused. */
export interface CoercedRequest {
	readonly query: string;
	readonly operationName: string;
	readonly variables: unknown;
}

/**
 * The errors graphql-yoga answers the request's variables with, in its
 * order (variables in declaration order, an object's fields in the
 * schema's, unknown fields last), each located at the variable's
 * definition in the query sent; empty when graphql takes every variable.
 */
export function coercionErrors(
	issues: readonly z.core.$ZodIssue[],
	request: CoercedRequest,
	operation: DeclaredVariables,
): GraphQLFormattedError[] {
	const definitions = definitionsOf(request.query, request.operationName);
	const sent =
		typeof request.variables === 'object' && request.variables !== null
			? (request.variables as Record<string, unknown>)
			: {};
	const walked = placed(issues);
	const { variableTypes = {}, inputTypes = {} } = operation;
	return Object.entries(variableTypes).flatMap(([name, source]) =>
		variableMessages(name, source, sent, {
			types: inputTypes,
			issues: walked,
			problems: [],
		}).map((refused) => located(refused, definitions.get(name))),
	);
}

/** One variable's messages, as @graphql-tools/executor's `getVariableValues` words them. */
function variableMessages(
	name: string,
	source: string,
	sent: Record<string, unknown>,
	walk: Walk,
): Refused[] {
	const { type, hasDefault } = declared(source);
	if (!Object.hasOwn(sent, name))
		return type.kind === 'non-null' && !hasDefault
			? [{ message: variableRefusal.notProvided(name, printType(type)) }]
			: [];
	const value = sent[name];
	if (value === null && type.kind === 'non-null')
		return [{ message: variableRefusal.isNull(name, printType(type)) }];
	validateValue(walk, value, type, { path: [], zodPath: [name] });
	return walk.problems.map(
		({ path, value: found, reason, extensions }: Problem) => ({
			message: variableRefusal.invalidValue(name, found, path, reason),
			...(extensions === undefined ? {} : { extensions }),
		}),
	);
}

/** One refusal: its message, and the `extensions` a custom scalar's error carries. */
interface Refused {
	readonly message: string;
	readonly extensions?: Record<string, unknown>;
}

function located(
	{ message, extensions }: Refused,
	definition: VariableDefinitionNode | undefined,
): GraphQLFormattedError {
	return new GraphQLError(message, {
		...(definition ? { nodes: definition } : {}),
		...(extensions === undefined ? {} : { extensions }),
	}).toJSON();
}
