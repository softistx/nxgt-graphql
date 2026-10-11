import {
	badUserInput,
	fieldIssueOf,
	invalidInputError,
	type Translate,
} from '@nxgt/graphql-validation';
import { z } from 'zod';
import type { AnyGraphQLError } from './response';

/** The operation whose variables were refused. */
export interface RefusedOperation {
	readonly type: 'query' | 'mutation';
	/** The operation's name in the document: `SignUp`. */
	readonly name: string;
}

/** What an invalid input is answered with: the one error, and the HTTP status. */
export interface InvalidInputAnswer {
	readonly error: AnyGraphQLError;
	readonly status: number;
}

/**
 * Answers an invalid input: the issues of the variables' Zod schema (each
 * `path` starting with the variable's name) and the operation, to the error
 * and status the handler responds with. The resolver is not called.
 */
export type InvalidInput = (
	issues: readonly z.core.$ZodIssue[],
	operation: RefusedOperation,
) => InvalidInputAnswer | Promise<InvalidInputAnswer>;

/**
 * The default answer: `invalidInputError`'s one 400 error, its `fields` the
 * issues in order through `fieldIssueOf` (`@nxgt/graphql-validation`'s),
 * each message `translate(code)`, or the code without a translator.
 */
export function invalidInputRefusal(
	options: { readonly translate?: Translate } = {},
): InvalidInput {
	const { translate } = options;
	return (issues) => ({
		error: invalidInputError(
			issues.map(fieldIssueOf),
			translate ? { translate } : {},
		),
		status: 400,
	});
}

/**
 * The answer `withValidation` gives: one `BAD_USER_INPUT` error,
 * `Invalid arguments for <operation>. <path>: <first message>`, its
 * `extensions.issues` each with its path inside the variables; status 200,
 * as a GraphQL server answers a resolver's error.
 */
export const badUserInputRefusal: InvalidInput = (issues, operation) => ({
	error: badUserInput(operation.name, new z.ZodError([...issues])),
	status: 200,
});
