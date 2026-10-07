import type { GraphQLField } from 'graphql';
import { z } from 'zod';
import type { InputSchemas } from './input-schema';

/**
 * The schema of a field's arguments, or `undefined` when none of them can
 * break a constraint, so a field with nothing to check is left untouched.
 * `parent` is the type's name, for errors: `Mutation.signUp(input:)`.
 */
export function argsSchemaOf(
	inputs: InputSchemas,
	parent: string,
	field: GraphQLField<unknown, unknown>,
): z.ZodType | undefined {
	if (!field.args.some((arg) => inputs.needsCheck(arg))) return undefined;
	return z.object(
		Object.fromEntries(
			field.args.map((arg) => [
				arg.name,
				inputs.of(arg, `${parent}.${field.name}(${arg.name}:)`),
			]),
		),
	);
}
