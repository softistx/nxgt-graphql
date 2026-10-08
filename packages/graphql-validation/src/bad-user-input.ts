import { GraphQLError } from 'graphql';
import type { z } from 'zod';
import type { ConstraintArgument } from './rules';

/** One reason an input was refused, at its path inside the arguments. */
export interface ValidationIssue {
	/** `['input', 'address', 'zip']`: the argument, then the input fields. */
	readonly path: readonly (string | number)[];
	readonly message: string;
	/** Zod's issue code: `too_small`, `invalid_format`, `custom`, ... */
	readonly code: string;
	/**
	 * The `@constraint` argument that refused (`minLength`, `format`), when a
	 * directive did: stable across Zod versions, unlike `code`. Absent for a
	 * refusal of `validated()`'s own schema.
	 */
	readonly constraint?: ConstraintArgument;
}

/** The `extensions` of the error an invalid input becomes. */
export type BadUserInputExtensions = {
	readonly code: 'BAD_USER_INPUT';
	readonly issues: readonly ValidationIssue[];
};

/** Names the `@constraint` argument behind an issue, when there is one. */
export type ConstraintOf = (
	issue: z.core.$ZodIssue,
) => ConstraintArgument | undefined;

function issuesOf(
	error: z.ZodError,
	constraintOf?: ConstraintOf,
): ValidationIssue[] {
	return error.issues.map((issue) => {
		const path = issue.path.map((key) =>
			typeof key === 'number' ? key : String(key),
		);
		const constraint = constraintOf?.(issue);
		return constraint
			? { path, message: issue.message, code: issue.code, constraint }
			: { path, message: issue.message, code: issue.code };
	});
}

function errorOf(where: string, issues: ValidationIssue[]): GraphQLError {
	const [first] = issues;
	const reason = first
		? `${first.path.join('.') || 'arguments'}: ${first.message}`
		: 'refused';
	const extensions: BadUserInputExtensions = { code: 'BAD_USER_INPUT', issues };
	return new GraphQLError(`Invalid arguments for ${where}. ${reason}`, {
		extensions,
	});
}

/**
 * The one error an invalid input becomes: `extensions.code` is
 * `BAD_USER_INPUT`, the code Apollo and most clients already read, and
 * `extensions.issues` lists every reason with its path, so a form can show
 * each one beside its field. The message names the field and the first
 * reason, for a log line.
 */
export function badUserInput(where: string, error: z.ZodError): GraphQLError {
	return errorOf(where, issuesOf(error));
}

/** The parsed arguments, or the error above, its issues named by `constraintOf`. */
export async function parseArgs(
	schema: z.ZodType,
	args: unknown,
	where: string,
	constraintOf?: ConstraintOf,
): Promise<unknown> {
	const result = await schema.safeParseAsync(args);
	if (!result.success)
		throw errorOf(where, issuesOf(result.error, constraintOf));
	return result.data;
}
