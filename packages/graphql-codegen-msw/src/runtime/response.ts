import type { GraphQLError, GraphQLFormattedError } from 'graphql';
import { HttpResponse } from 'msw';

/** An error as a resolver throws it, or as it goes on the wire. */
export type AnyGraphQLError = GraphQLError | GraphQLFormattedError;

/**
 * Whether `value` is a `GraphQLError`, from any copy of `graphql`: by its
 * name (or its `[object GraphQLError]` tag, which a subclass with its own
 * `name` keeps) and its `toJSON`, never `instanceof`, so an error your
 * application built with its own `graphql` is one too.
 */
export function isGraphQLError(value: unknown): value is GraphQLError {
	return (
		value instanceof Error &&
		(value.name === 'GraphQLError' ||
			Object.prototype.toString.call(value) === '[object GraphQLError]') &&
		typeof (value as { toJSON?: unknown }).toJSON === 'function'
	);
}

/** `error` as the response carries it: a `GraphQLError`'s `toJSON()`, or itself. */
export function formatted(error: AnyGraphQLError): GraphQLFormattedError {
	return isGraphQLError(error) ? error.toJSON() : error;
}

/**
 * `extensions.http.status`, when it is a status a response can carry: an
 * integer from 200 to 599 other than 204, 205 and 304, which have no body.
 */
export function statusOf(error: AnyGraphQLError): number | undefined {
	const http = (error.extensions as { http?: { status?: unknown } } | undefined)
		?.http;
	const status = http?.status;
	return typeof status === 'number' &&
		Number.isInteger(status) &&
		status >= 200 &&
		status <= 599 &&
		status !== 204 &&
		status !== 205 &&
		status !== 304
		? status
		: undefined;
}

/**
 * A GraphQL response holding `errors` only: `{ errors: [error] }`, with
 * `status`, else the error's `extensions.http.status`, else 200. What a
 * resolver returns to refuse, as your server would:
 * `return errorResponse(fieldsError('conflict', fields, { status: 409 }))`.
 */
export function errorResponse(
	error: AnyGraphQLError | readonly AnyGraphQLError[],
	init: { readonly status?: number } = {},
): HttpResponse<{ errors: GraphQLFormattedError[] }> {
	const errors = (Array.isArray(error) ? error : [error]) as AnyGraphQLError[];
	const status =
		init.status ??
		errors.map(statusOf).find((found) => found !== undefined) ??
		200;
	return HttpResponse.json({ errors: errors.map(formatted) }, { status });
}
