import {
	type GraphQLDirective,
	type GraphQLField,
	type GraphQLObjectType,
	type GraphQLSchema,
	isInterfaceType,
	isObjectType,
} from 'graphql';
import type { z } from 'zod';
import { assertOwnConstraint } from '../constraint-directive';
import { type FormatSchemas, registryOf } from '../formats/registry';
import { argsSchemaOf, assertInterfaceConstraintsKept } from './args-schema';
import { constraintsOn } from './constraints';
import { InputSchemas } from './input-schema';

/**
 * Runs every check `withValidation` makes at startup, so a code generator
 * refuses the same schemas: the declaration is `constraintTypeDefs`', every
 * constraint applies where it is written (in every input type), none sits on
 * a directive's argument, objects keep their interfaces' constraints, and no
 * default value breaks its own. `onArgs` receives each object field's
 * arguments schema, for a field with something to check.
 *
 * `formats` are the application's own, which `@constraint(format: "...")`
 * may name beside the built-in ones; they are checked first (name, no
 * built-in replaced, a Zod string schema each).
 *
 * Returns the `@constraint` directive, or `undefined` when the schema
 * declares none (and so carries no constraint).
 */
export function checkConstraints(
	schema: GraphQLSchema,
	onArgs?: (
		type: GraphQLObjectType,
		field: GraphQLField<unknown, unknown>,
		args: z.ZodType,
	) => void,
	formats?: FormatSchemas,
): GraphQLDirective | undefined {
	const inputs = new InputSchemas(schema, registryOf(formats));
	if (!inputs.directive) return undefined;
	assertOwnConstraint(inputs.directive);
	inputs.buildAll(schema);
	assertNoDirectiveArgumentConstrained(inputs, schema);
	for (const type of Object.values(schema.getTypeMap())) {
		if (type.name.startsWith('__')) continue;
		// An interface's fields resolve on its objects: built for their errors only.
		if (isInterfaceType(type)) {
			for (const field of Object.values(type.getFields()))
				argsSchemaOf(inputs, type.name, field);
		}
		if (!isObjectType(type)) continue;
		assertInterfaceConstraintsKept(inputs, type);
		for (const field of Object.values(type.getFields()) as GraphQLField<
			unknown,
			unknown
		>[]) {
			const args = argsSchemaOf(inputs, type.name, field);
			if (args) onArgs?.(type, field, args);
		}
	}
	inputs.checkDefaults();
	return inputs.directive;
}

/**
 * Fails on a `@constraint` written on a directive's argument: graphql allows
 * it there (ARGUMENT_DEFINITION), but no resolver receives that argument, so
 * it would check nothing.
 */
function assertNoDirectiveArgumentConstrained(
	inputs: InputSchemas,
	schema: GraphQLSchema,
): void {
	for (const directive of schema.getDirectives()) {
		for (const arg of directive.args) {
			if (constraintsOn(inputs.directive, arg.astNode).length > 0) {
				throw new Error(
					`@constraint on @${directive.name}(${arg.name}:) checks nothing: a directive's argument reaches no resolver. Remove it.`,
				);
			}
		}
	}
}
