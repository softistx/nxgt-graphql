import type {
	Path,
	RequestHandlerOptions,
	ResponseResolverInfo,
	ResponseResolverReturnType,
} from 'msw';
import {
	type GraphQLHandler,
	type GraphQLQuery,
	type GraphQLResponseBody,
	type GraphQLVariables,
	graphql,
} from 'msw/graphql';
import type { z } from 'zod';
import { COERCION_STATUS, coercionErrors, type InputTypes } from './coercion';
import type { InvalidInput, RefusedOperation } from './refusals';
import { errorResponse, isGraphQLError } from './response';

/**
 * What a resolver receives: msw's own resolver info for a GraphQL
 * operation (`variables`, `query`, `operationName`, `request`, `cookies`,
 * `requestId`, `finalize`), `variables` typed with the operation's
 * variables type. They are the variables as sent: checked, not parsed.
 */
export type GraphQLMockInfo<Variables extends GraphQLVariables> =
	ResponseResolverInfo<{
		query: string;
		operationName: string;
		variables: Variables;
		cookies: Record<string, string>;
	}>;

/**
 * A handler's resolver, as msw's `graphql.link(...).query(name, resolver)`
 * takes one, without its generator form: return
 * `HttpResponse.json({ data })`, an `errorResponse(...)`, or nothing to
 * let the next handler answer; throw a `GraphQLError` to answer with it.
 */
export type GraphQLMockResolver<
	Result extends GraphQLQuery,
	Variables extends GraphQLVariables,
> = (
	info: GraphQLMockInfo<Variables>,
) =>
	| ResponseResolverReturnType<GraphQLResponseBody<Result>>
	| Promise<ResponseResolverReturnType<GraphQLResponseBody<Result>>>;

/** A handler's options: msw's (`once`), and an endpoint for this handler only. */
export interface MockOptions extends RequestHandlerOptions {
	/** Overrides the generated `endpoint` for this handler: a URL or a path msw matches. */
	readonly endpoint?: Path;
}

/** One operation, as the generated file describes it. */
export interface MockedOperation {
	readonly type: 'query' | 'mutation';
	/** The operation's name in the document: `SignUp`. */
	readonly name: string;
	/** The variables' schema, from `@nxgt/graphql-codegen-zod`: `zSignUpMutationVariables`. */
	readonly variables: z.ZodType;
	/**
	 * Each variable's GraphQL type, with its default: `{ first: "Int = 10" }`.
	 * Internal: written by the plugin for the coercion answer, its form may
	 * change in any version together with the generated file. Defaults to
	 * `{}`: no variable is walked, and every refusal goes to `invalidInput`.
	 */
	readonly variableTypes?: Readonly<Record<string, string>> | undefined;
	/**
	 * The input types the variables reach, from the schema. Internal, as
	 * `variableTypes`; defaults to `{}`.
	 */
	readonly inputTypes?: InputTypes | undefined;
	readonly endpoint: Path;
	readonly invalidInput: InvalidInput;
}

/**
 * An msw handler for one operation: `graphql.link(endpoint)`'s `query` or
 * `mutation` by the operation's name. Its variables are checked with the
 * operation's schema first, without calling `resolver` when they fail: a
 * value graphql refuses while coercing the variables (missing, null, of
 * the wrong type, an unknown enum value or field, an Int beyond 32 bits, a
 * value a custom scalar refuses) is answered as graphql-yoga answers it
 * (`coercionErrors`, status 400), whatever `invalidInput` is; any other
 * invalid input with `invalidInput`'s error and status. A `GraphQLError`
 * the resolver throws is answered as `errorResponse` answers it; anything
 * else it throws is msw's to answer (a 500).
 */
export function mockOperation<
	Result extends GraphQLQuery,
	Variables extends GraphQLVariables,
>(
	operation: MockedOperation,
	resolver: GraphQLMockResolver<Result, Variables>,
	options: MockOptions = {},
): GraphQLHandler {
	const { endpoint = operation.endpoint, ...handlerOptions } = options;
	const link = graphql.link(endpoint);
	const where = { type: operation.type, name: operation.name };
	return link[operation.type](
		operation.name,
		async (info) => {
			const refusal = await refuseInvalid(operation, info, where);
			if (refusal) return refusal;
			try {
				const answer = await resolver(info as GraphQLMockInfo<Variables>);
				assertNotIterator(answer, operation.name);
				return answer;
			} catch (error) {
				if (isGraphQLError(error)) return errorResponse(error);
				throw error;
			}
		},
		handlerOptions,
	);
}

/**
 * The answer to variables `operation.variables` refuses, or `undefined`
 * when they pass: a value graphql refuses while coercing is answered as
 * graphql-yoga answers it (status 400), any other with `invalidInput`.
 */
export async function refuseInvalid(
	operation: Pick<
		MockedOperation,
		'variables' | 'variableTypes' | 'inputTypes' | 'invalidInput'
	>,
	info: { query: string; operationName: string; variables: unknown },
	where: RefusedOperation,
): Promise<Response | undefined> {
	const checked = await operation.variables.safeParseAsync(info.variables);
	if (checked.success) return undefined;
	const { issues } = checked.error;
	// The API refuses these while coercing the variables, before its own
	// validation: whatever invalidInput says.
	const refused = coercionErrors(issues, info, operation);
	if (refused.length > 0)
		return errorResponse(refused, { status: COERCION_STATUS });
	// A status no response can carry is ignored, as errorResponse ignores
	// it: the error's own, else 200.
	const { error, status } = await operation.invalidInput(issues, where);
	return errorResponse(error, { status });
}

/**
 * msw would keep a generator's iterator and answer the next requests from
 * it without calling this handler's resolver again, so their variables would
 * go unchecked: refused instead.
 */
function assertNotIterator(answer: unknown, name: string): void {
	if (
		typeof answer === 'object' &&
		answer !== null &&
		!(answer instanceof Response) &&
		typeof (answer as { next?: unknown }).next === 'function'
	) {
		throw new TypeError(
			`@nxgt/graphql-codegen-msw: the resolver of ${name} returned an iterator (a generator function?). Each request's variables are checked before the resolver runs, which msw cannot do once it keeps an iterator: answer each request from a plain function, or register one handler per answer with { once: true }.`,
		);
	}
}
