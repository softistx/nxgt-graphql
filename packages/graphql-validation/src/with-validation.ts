import {
	defaultFieldResolver,
	type GraphQLField,
	type GraphQLFieldResolver,
	type GraphQLSchema,
	isInterfaceType,
	isObjectType,
} from 'graphql';
import type { z } from 'zod';
import { parseArgs } from './bad-user-input';
import {
	argsSchemaOf,
	assertInterfaceConstraintsKept,
} from './builder/args-schema';
import { InputSchemas } from './builder/input-schema';
import { assertOwnConstraint } from './constraint-directive';
import { constraintOf } from './rules';

const wrapped = Symbol('graphql-validation');

type Resolver = GraphQLFieldResolver<unknown, unknown> & { [wrapped]?: true };

function checking(
	schema: z.ZodType,
	where: string,
	resolve: Resolver,
): Resolver {
	const check: Resolver = async (source, args, context, info) =>
		await resolve(
			source,
			await parseArgs(schema, args, where, constraintOf),
			context,
			info,
		);
	check[wrapped] = true;
	return check;
}

/**
 * Wraps a field once. A subscription field is checked in `subscribe`, which
 * runs once per subscription; its `resolve` runs once per event, with the
 * same arguments, already checked.
 */
function wrap(
	field: GraphQLField<unknown, unknown>,
	args: z.ZodType,
	where: string,
): void {
	const subscribe = field.subscribe as Resolver | undefined;
	if (subscribe) {
		if (!subscribe[wrapped]) field.subscribe = checking(args, where, subscribe);
		return;
	}
	const resolve = (field.resolve ?? defaultFieldResolver) as Resolver;
	if (!resolve[wrapped]) field.resolve = checking(args, where, resolve);
}

/**
 * Checks every `@constraint` of `schema` before the resolvers run. Each
 * field with a constrained argument — directly, or anywhere inside an input
 * type it takes — gets its resolver (and its `subscribe`) wrapped: the
 * arguments are parsed by the Zod schema the directives describe, the
 * resolver receives the parsed value, and an invalid input becomes one
 * `BAD_USER_INPUT` error. Fields with nothing to check are left untouched.
 *
 * The schema is built here, once: a constraint that cannot apply (a
 * `minLength` on an `Int`, an unknown format, a bad pattern) throws now, not
 * on the first request. The resolvers are wrapped in place and the same
 * schema is returned, so it goes wherever it went before; calling it twice
 * wraps nothing twice. Call it last, once every resolver is attached: a
 * resolver set on a field afterwards replaces the check.
 *
 * A `@constraint` on an interface's argument must be repeated on each
 * object's field, which is the one that resolves; a field that drops it
 * fails here.
 *
 * The directives are read from the SDL (`astNode`), so a schema built from
 * type definitions — `buildSchema`, `makeExecutableSchema`, Yoga, Apollo —
 * is checked; a code-first schema with no SDL has no `@constraint` to read.
 */
export function withValidation<S extends GraphQLSchema>(schema: S): S {
	const inputs = new InputSchemas(schema);
	if (!inputs.directive) {
		throw new Error(
			'withValidation: this schema declares no @constraint directive. Add constraintTypeDefs to its type definitions.',
		);
	}
	assertOwnConstraint(inputs.directive);
	inputs.buildAll(schema);
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
			if (args) wrap(field, args, `${type.name}.${field.name}`);
		}
	}
	inputs.checkDefaults();
	return schema;
}
