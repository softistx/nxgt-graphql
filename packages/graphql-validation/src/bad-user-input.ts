import { GraphQLError } from 'graphql';
import type { z } from 'zod';

/** One reason an input was refused, at its path inside the arguments. */
export interface ValidationIssue {
	/** `['input', 'address', 'zip']`: the argument, then the input fields. */
	readonly path: readonly (string | number)[];
	readonly message: string;
	/** Zod's issue code: `too_small`, `invalid_format`, `custom`, ... */
	readonly code: string;
}

/** The `extensions` of the error an invalid input becomes. */
export type BadUserInputExtensions = {
	readonly code: 'BAD_USER_INPUT';
	readonly issues: readonly ValidationIssue[];
};

/**
 * The one error an invalid input becomes: `extensions.code` is
 * `BAD_USER_INPUT`, the code Apollo and most clients already read, and
 * `extensions.issues` lists every reason with its path, so a form can show
 * each one beside its field. The message names the field and the first
 * reason, for a log line.
 */
export function badUserInput(where: string, error: z.ZodError): GraphQLError {
	const issues: ValidationIssue[] = error.issues.map((issue) => ({
		path: issue.path.map((key) =>
			typeof key === 'number' ? key : String(key),
		),
		message: issue.message,
		code: issue.code,
	}));
	const [first] = issues;
	const reason = first
		? `${first.path.join('.') || 'arguments'}: ${first.message}`
		: 'refused';
	const extensions: BadUserInputExtensions = { code: 'BAD_USER_INPUT', issues };
	return new GraphQLError(`Invalid arguments for ${where}. ${reason}`, {
		extensions,
	});
}

/** The parsed arguments, or the error above. */
export async function parseArgs(
	schema: z.ZodType,
	args: unknown,
	where: string,
): Promise<unknown> {
	const result = await schema.safeParseAsync(args);
	if (!result.success) throw badUserInput(where, result.error);
	return result.data;
}
