import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { z } from 'zod';
import { parseArgs } from './bad-user-input';

/** An object schema of the arguments, or its shape. */
export type ArgsSchema = z.ZodType<Record<string, unknown>> | z.ZodRawShape;

/** The schema `ArgsSchema` stands for. */
export type SchemaOf<S extends ArgsSchema> = S extends z.ZodType
	? S
	: z.ZodObject<S & z.ZodRawShape>;

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
 */
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
> {
	const checked: z.ZodType =
		schema instanceof z.ZodType ? schema : z.object(schema);
	return async (source, args, context, info): Promise<Awaited<TResult>> => {
		const where = `${info.parentType.name}.${info.fieldName}`;
		const parsed = (await parseArgs(checked, args, where)) as z.output<
			SchemaOf<S>
		>;
		return await resolve(source, parsed, context, info);
	};
}
