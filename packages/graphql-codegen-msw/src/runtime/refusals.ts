import {
	badUserInput,
	type FieldIssue,
	inputPath,
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

/** A Zod path as `inputPath` reads it: symbols as their description. */
function pathOf(issue: z.core.$ZodIssue): (string | number)[] {
	return issue.path.map((key) => (typeof key === 'number' ? key : String(key)));
}

/**
 * A Zod issue as a `FieldIssue`: the path through `inputPath`, and the code
 * the API answers for the constraint, without params:
 * `validation.errors.too-short` / `too-long` (a string's length),
 * `out-of-range` (a number's or bigint's bound, a multiple),
 * `too-few` / `too-many` (a list's or set's size), `invalid-format` (a
 * format or pattern), `invalid` (anything else).
 */
export function fieldIssueOf(issue: z.core.$ZodIssue): FieldIssue {
	return { path: inputPath(pathOf(issue)), code: codeOf(issue) };
}

function codeOf(issue: z.core.$ZodIssue): string {
	switch (issue.code) {
		case 'too_small':
		case 'too_big': {
			const small = issue.code === 'too_small';
			switch (issue.origin) {
				case 'string':
					return small ? FIELD_CODES.tooShort : FIELD_CODES.tooLong;
				case 'number':
				case 'bigint':
					return FIELD_CODES.outOfRange;
				case 'array':
				case 'set':
					return small ? FIELD_CODES.tooFew : FIELD_CODES.tooMany;
				default:
					return FIELD_CODES.invalid;
			}
		}
		case 'not_multiple_of':
			return FIELD_CODES.outOfRange;
		case 'invalid_format':
			return FIELD_CODES.invalidFormat;
		default:
			return FIELD_CODES.invalid;
	}
}

/** The field codes the default answer writes, as the API answers them. */
const FIELD_CODES = {
	tooShort: 'validation.errors.too-short',
	tooLong: 'validation.errors.too-long',
	outOfRange: 'validation.errors.out-of-range',
	tooFew: 'validation.errors.too-few',
	tooMany: 'validation.errors.too-many',
	invalidFormat: 'validation.errors.invalid-format',
	invalid: 'validation.errors.invalid',
} as const;

/**
 * The default answer: `invalidInputError`'s one 400 error, its `fields`
 * the issues in order (see `fieldIssueOf`), each message `translate(code)`,
 * or the code without a translator.
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
