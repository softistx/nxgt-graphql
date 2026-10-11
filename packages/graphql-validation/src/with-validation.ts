import {
	defaultFieldResolver,
	type GraphQLField,
	type GraphQLFieldResolver,
	type GraphQLSchema,
} from 'graphql';
import type { z } from 'zod';
import { parseArgs } from './bad-user-input';
import { checkConstraints } from './builder/check-constraints';
import type { FormatSchemas, OwnFormats } from './formats/registry';
import { constraintOf } from './rules';

// Symbol.for: two copies of the package in one tree still wrap a field once.
const wrapped = Symbol.for('@nxgt/graphql-validation/wrapped');
// The formats a schema was wrapped with, kept on the schema itself.
const wrappedWith = Symbol.for('@nxgt/graphql-validation/formats');

/** What `withValidation` takes besides the schema. */
export interface WithValidationOptions<
	F extends FormatSchemas = FormatSchemas,
> {
	/**
	 * The application's own formats, which `@constraint(format: "...")` may
	 * name beside the built-in ones: one Zod string schema each, keyed by its
	 * name (lowercase letters, digits and hyphens). A built-in name is a type
	 * error, and refused at startup.
	 */
	readonly formats?: OwnFormats<F>;
}

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
 * runs once per subscription — graphql's default one when the field has none
 * — and its `resolve` runs once per event, with the same arguments, already
 * checked.
 */
function wrap(
	field: GraphQLField<unknown, unknown>,
	args: z.ZodType,
	where: string,
	subscription: boolean,
): void {
	const subscribe = (field.subscribe ??
		(subscription ? defaultFieldResolver : undefined)) as Resolver | undefined;
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
 *
 * `options.formats` adds the application's own formats; wrapping a schema
 * again with other formats throws, since its fields are already checked
 * against the first ones.
 */
export function withValidation<
	S extends GraphQLSchema,
	// biome-ignore lint/complexity/noBannedTypes: no formats of its own by default
	const F extends FormatSchemas = {},
>(schema: S, options: WithValidationOptions<F> = {}): S {
	const formats: FormatSchemas = options.formats ?? {};
	const holder = schema as unknown as { [wrappedWith]?: FormatSchemas };
	const before = holder[wrappedWith];
	if (before && !sameFormats(before, formats)) {
		throw new Error(
			'withValidation: this schema is already wrapped with other formats. Call withValidation once, with every format.',
		);
	}
	const directive = checkConstraints(
		schema,
		(type, field, args) => {
			const subscription = type === schema.getSubscriptionType();
			wrap(field, args, `${type.name}.${field.name}`, subscription);
		},
		formats,
	);
	if (!directive) {
		throw new Error(
			'withValidation: this schema declares no @constraint directive. Add constraintTypeDefs to its type definitions.',
		);
	}
	if (!before) Object.defineProperty(schema, wrappedWith, { value: formats });
	return schema;
}

/** The same names, each the very same schema. */
function sameFormats(a: FormatSchemas, b: FormatSchemas): boolean {
	const names = Object.keys(a);
	return (
		names.length === Object.keys(b).length &&
		names.every((name) => Object.hasOwn(b, name) && a[name] === b[name])
	);
}
