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
import { argsSchemaOf } from './build/args-schema';
import { InputSchemas } from './build/input-schema';

const wrapped = Symbol('graphql-validation');

type Resolver = GraphQLFieldResolver<unknown, unknown> & { [wrapped]?: true };

function checking(
	schema: z.ZodType,
	where: string,
	resolve: Resolver,
): Resolver {
	const check: Resolver = async (source, args, context, info) =>
		await resolve(source, await parseArgs(schema, args, where), context, info);
	check[wrapped] = true;
	return check;
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
 * wraps nothing twice.
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
	inputs.buildAll(schema);
	for (const type of Object.values(schema.getTypeMap())) {
		if (!isObjectType(type) && !isInterfaceType(type)) continue;
		if (type.name.startsWith('__')) continue;
		for (const field of Object.values(type.getFields()) as GraphQLField<
			unknown,
			unknown
		>[]) {
			const args = argsSchemaOf(inputs, type.name, field);
			if (!args) continue;
			if (!isObjectType(type)) continue; // an interface's fields resolve on its objects
			const where = `${type.name}.${field.name}`;
			const resolve = (field.resolve ?? defaultFieldResolver) as Resolver;
			if (!resolve[wrapped]) field.resolve = checking(args, where, resolve);
			const subscribe = field.subscribe as Resolver | undefined;
			if (subscribe && !subscribe[wrapped])
				field.subscribe = checking(args, where, subscribe);
		}
	}
	return schema;
}
