import type { GraphQLArgument, GraphQLField, GraphQLObjectType } from 'graphql';
import { z } from 'zod';
import { constraintsOn } from './constraints';
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

/** The constraints of an argument as written, sorted: `maxLength: 5, min: 1`. */
function signature(inputs: InputSchemas, arg: GraphQLArgument): string {
	return constraintsOn(inputs.directive, arg.astNode)
		.map(({ rule, value }) => `${rule.argument}: ${JSON.stringify(value)}`)
		.sort()
		.join(', ');
}

/** A signature as it reads in an error. */
const written = (signature: string) =>
	signature ? `@constraint(${signature})` : 'no @constraint';

/**
 * Fails when an object type's field does not repeat the `@constraint` its
 * interface writes on an argument. The object's field is the one that
 * resolves, and graphql lets it redeclare the argument bare: the interface's
 * constraint would then check nothing, in silence.
 */
export function assertInterfaceConstraintsKept(
	inputs: InputSchemas,
	type: GraphQLObjectType,
): void {
	for (const contract of type.getInterfaces()) {
		for (const [name, declared] of Object.entries(contract.getFields())) {
			const field = type.getFields()[name];
			for (const arg of declared.args) {
				const wanted = signature(inputs, arg);
				if (!wanted) continue;
				const own = field?.args.find(
					({ name: argName }) => argName === arg.name,
				);
				const found = own ? signature(inputs, own) : wanted;
				if (found !== wanted) {
					const verb = found ? 'differs on' : 'is not repeated on';
					throw new Error(
						`@constraint on ${contract.name}.${name}(${arg.name}:) ${verb} ${type.name}.${name}(${arg.name}:), which resolves it (${written(wanted)} there, ${written(found)} here). Write the same @constraint on both.`,
					);
				}
			}
		}
	}
}
