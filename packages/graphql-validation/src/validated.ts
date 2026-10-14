import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { z } from 'zod';
import { parseArgs } from './bad-user-input';

/** An object schema of the arguments, or its shape. */
export type ArgsSchema = z.ZodType<Record<string, unknown>> | z.ZodRawShape;

/** The schema `ArgsSchema` stands for. */
export type SchemaOf<S extends ArgsSchema> = S extends z.ZodType
	? S
	: S extends z.ZodRawShape
		? // Mapped, not `S & z.ZodRawShape`: the intersection's index signature
			// would type every argument `unknown`.
			z.ZodObject<{ [K in keyof S]: S[K] }>
		: never;

/**
 * What `validated` takes: the schema, or a function that builds it for each
 * call from the request's context and the field's `info`, for checks that
 * need them (a uniqueness query in the request's database, a rule that
 * depends on the viewer).
 */
export type ArgsSchemaFor<S extends ArgsSchema, TContext = unknown> =
	| S
	| SchemaFactory<S, TContext>;

type SchemaFactory<S extends ArgsSchema, TContext> = (
	context: TContext,
	info: GraphQLResolveInfo,
) => S | Promise<S>;

/**
 * A resolver whose arguments are checked by `schema` before it runs, for what
 * a `@constraint` cannot say: a rule across arguments, a business refinement,
 * an async check. It receives the parsed arguments (`z.output`), defaults and
 * transforms applied; an invalid input is the same `BAD_USER_INPUT` error as
 * the directives'.
 *
 * ```ts
 * signUp: validated(
 *   z.object({ input: signUpSchema }).refine(({ input }) => input.password !== input.email),
 *   (_, { input }) => users.create(input),
 * )
 * ```
 *
 * A check that needs the request takes a function in place of the schema:
 * it is called on each call, with the context and `info`, and returns the
 * schema (or a promise of it). What it throws reaches the client as it is,
 * not as `BAD_USER_INPUT`.
 *
 * ```ts
 * rename: validated(
 *   (ctx: Context) => ({
 *     name: z.string().refine(async (name) => !(await ctx.db.users.exists({ name })), 'taken'),
 *   }),
 *   (_, { name }, ctx) => ctx.db.users.rename(ctx.viewer, name),
 * )
 * ```
 */
export function validated<
	S extends ArgsSchema,
	TSource = unknown,
	TContext = unknown,
	TResult = unknown,
>(
	schema: SchemaFactory<S, TContext>,
	resolve: (
		source: TSource,
		args: z.output<SchemaOf<S>>,
		context: TContext,
		info: GraphQLResolveInfo,
	) => TResult,
): GraphQLFieldResolver<
	TSource,
	TContext,
	z.input<SchemaOf<S>>,
	Promise<Awaited<TResult>>
>;
export function validated<
	S extends ArgsSchema,
	TSource = unknown,
	TContext = unknown,
	TResult = unknown,
>(
	schema: S,
	resolve: (
		source: TSource,
		args: z.output<SchemaOf<S>>,
		context: TContext,
		info: GraphQLResolveInfo,
	) => TResult,
): GraphQLFieldResolver<
	TSource,
	TContext,
	z.input<SchemaOf<S>>,
	Promise<Awaited<TResult>>
>;
export function validated<
	S extends ArgsSchema,
	TSource = unknown,
	TContext = unknown,
	TResult = unknown,
>(
	schema: ArgsSchemaFor<S, TContext>,
	resolve: (
		source: TSource,
		args: z.output<SchemaOf<S>>,
		context: TContext,
		info: GraphQLResolveInfo,
	) => TResult,
): GraphQLFieldResolver<
	TSource,
	TContext,
	z.input<SchemaOf<S>>,
	Promise<Awaited<TResult>>
>;
export function validated<
	S extends ArgsSchema,
	TSource = unknown,
	TContext = unknown,
	TResult = unknown,
>(
	schema: ArgsSchemaFor<S, TContext>,
	resolve: (
		source: TSource,
		args: z.output<SchemaOf<S>>,
		context: TContext,
		info: GraphQLResolveInfo,
	) => TResult,
): GraphQLFieldResolver<
	TSource,
	TContext,
	z.input<SchemaOf<S>>,
	Promise<Awaited<TResult>>
> {
	const fixed = typeof schema === 'function' ? undefined : zodOf(schema);
	return async (source, args, context, info): Promise<Awaited<TResult>> => {
		const where = `${info.parentType.name}.${info.fieldName}`;
		const checked =
			fixed ??
			zodOf(await (schema as SchemaFactory<S, TContext>)(context, info));
		const parsed = (await parseArgs(checked, args, where)) as z.output<
			SchemaOf<S>
		>;
		return await resolve(source, parsed, context, info);
	};
}

/** The schema itself, or the object schema of a shape. */
function zodOf(schema: ArgsSchema): z.ZodType {
	// `_zod`, not `instanceof`: a schema from another copy of zod is still one.
	return (
		'_zod' in schema ? schema : z.object(schema as z.ZodRawShape)
	) as z.ZodType;
}
