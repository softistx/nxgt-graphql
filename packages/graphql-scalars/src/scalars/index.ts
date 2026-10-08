import { GraphQLScalarType } from 'graphql';
import { z } from 'zod';
import { typeDefsOf } from '../type-defs';
import * as all from './all';

export * from './all';

type All = typeof all;

/**
 * Every scalar of this package, keyed by its GraphQL name. Derived from what
 * `./all` exports, so a new scalar is registered by its category's
 * `index.ts` alone.
 */
export type ScalarResolvers = {
	[K in keyof All as All[K] extends GraphQLScalarType & {
		readonly name: infer N extends string;
	}
		? N
		: never]: All[K];
};

/** The GraphQL name of one of this package's scalars. */
export type ScalarName = keyof ScalarResolvers;

/**
 * The schema behind each scalar, keyed by its export name without `Schema`:
 * `dateTimeSchema` is `schemas.dateTime`.
 */
export type Schemas = {
	[K in keyof All as All[K] extends z.ZodType
		? K extends `${infer Base}Schema`
			? Base
			: never
		: never]: All[K];
};

/**
 * The schema behind each scalar, keyed by its GraphQL name:
 * `ScalarSchemas['DateTime']` is `typeof dateTimeSchema`.
 */
export type ScalarSchemas = {
	[N in ScalarName]: ScalarResolvers[N]['schema'];
};

// A module namespace lists its exports in alphabetical order, so both maps,
// and the SDL, come out in a stable order.
const exported: [string, unknown][] = Object.entries(all);

/**
 * Every scalar, keyed by its GraphQL name: the `resolvers` entry a
 * schema-first server (`makeExecutableSchema`, Yoga, Apollo) takes beside
 * {@link scalarTypeDefs}. {@link pickScalars} takes some of them only.
 */
export const scalarResolvers = Object.fromEntries(
	exported
		.map(([, value]) => value)
		.filter((value) => value instanceof GraphQLScalarType)
		.map((scalar) => [scalar.name, scalar]),
) as ScalarResolvers;

/**
 * The schemas behind the scalars, so an application validates a value the
 * way the API does — in a form, a REST handler or a job — with the same rule
 * and the same `z.input`/`z.output` types.
 */
export const schemas = Object.fromEntries(
	exported
		.filter(
			([key, value]) => value instanceof z.ZodType && key.endsWith('Schema'),
		)
		.map(([key, value]) => [key.replace(/Schema$/, ''), value]),
) as Schemas;

/**
 * The schema behind each scalar, keyed by its GraphQL name, in the order of
 * {@link scalarResolvers}: `scalarSchemas.DateTime` is `dateTimeSchema`, the
 * very schema the scalar checks, so `z.decode(scalarSchemas.X, wire)` gives
 * what a resolver receives and `z.input`/`z.output` are the wire and resolver
 * types. Code generators read it under this name.
 */
export const scalarSchemas = Object.fromEntries(
	Object.entries(scalarResolvers).map(([name, scalar]) => [
		name,
		scalar.schema,
	]),
) as ScalarSchemas;

/** The SDL that declares every scalar of {@link scalarResolvers}. */
export const scalarTypeDefs: string = typeDefsOf(
	Object.values(scalarResolvers),
);
