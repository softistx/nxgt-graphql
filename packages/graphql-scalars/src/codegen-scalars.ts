import { z } from 'zod';
import { type ScalarName, scalarSchemas } from './scalars';

/** One entry of graphql-codegen's `scalars` config: two TypeScript types. */
export type CodegenScalar = { readonly input: string; readonly output: string };

/** A `scalars` config for every scalar of this package, keyed by its name. */
export type CodegenScalars = { readonly [N in ScalarName]: CodegenScalar };

/** Which side of a schema to read: what it takes, or what it gives. */
type Side = 'input' | 'output';

/** The schema types whose TypeScript type is a name, as tsc prints it. */
const NAMED: Readonly<Record<string, string>> = {
	string: 'string',
	number: 'number',
	boolean: 'boolean',
	bigint: 'bigint',
	date: 'Date',
	null: 'null',
	undefined: 'undefined',
};

/**
 * The TypeScript type of one side of `schema`, as text: `z.input` for
 * `'input'`, `z.output` for `'output'`. A codec reads its wire schema on the
 * way in and its decoded one on the way out; a union joins its options. What
 * this does not name is `unknown`, as `z.json()` is. `codegen-scalars.spec.ts`
 * holds each result to the type tsc gives `z.input`/`z.output`.
 */
function typeOf(schema: z.ZodType, side: Side): string {
	const def = schema._zod.def as z.core.$ZodTypeDef & {
		in?: z.ZodType;
		out?: z.ZodType;
		options?: z.ZodType[];
		innerType?: z.ZodType;
		getter?: () => z.ZodType;
	};
	const named = NAMED[def.type];
	if (named !== undefined) return named;
	if (def.type === 'pipe' && def.in && def.out) {
		return typeOf(side === 'input' ? def.in : def.out, side);
	}
	if (def.type === 'union' && def.options) {
		return [...new Set(def.options.map((o) => typeOf(o, side)))].join(' | ');
	}
	if (def.type === 'lazy' && def.getter) return typeOf(def.getter(), side);
	if (def.type === 'readonly' && def.innerType) {
		return typeOf(def.innerType, side);
	}
	return 'unknown';
}

/** The members of union types, once each, in order: `string | Date`. */
function union(...types: string[]): string {
	return [...new Set(types.flatMap((type) => type.split(' | ')))].join(' | ');
}

/**
 * What a client may put in a variable beyond the wire type: a decoded value
 * whose JSON form the scalar takes back. A `Date` serializes to an ISO
 * string, which a `DateTime` takes and a `Timestamp` (a number) does not; a
 * `bigint` has no JSON form at all.
 */
function sendable(schema: z.ZodType): string[] {
	return typeOf(schema, 'output')
		.split(' | ')
		.filter(
			(type) =>
				type === 'Date' &&
				z.safeDecode(schema, new Date(0).toJSON() as never).success,
		);
}

/** The map for one side of the wire: `server` or `client`. */
function codegenScalarsFor(
	read: (schema: z.ZodType) => CodegenScalar,
): CodegenScalars {
	return Object.fromEntries(
		Object.entries(scalarSchemas).map(([name, schema]) => [
			name,
			read(schema as z.ZodType),
		]),
	) as CodegenScalars;
}

/**
 * graphql-codegen's `scalars` config for a **server**
 * (`typescript-resolvers`): what a resolver receives is the decoded value
 * (`z.output`: a `Date` for `DateTime`, a `bigint` for `Long`), and what it
 * returns is that or the wire value (`Date | string`), both of which the
 * scalar encodes on the way out. Keyed and ordered as
 * {@link scalarResolvers}.
 */
export const codegenScalars: CodegenScalars = codegenScalarsFor((schema) => ({
	input: typeOf(schema, 'output'),
	output: union(typeOf(schema, 'output'), typeOf(schema, 'input')),
}));

/**
 * graphql-codegen's `scalars` config for a **client**
 * (`typescript-operations`): a result is what crosses the wire (`z.input`:
 * a `string` for `DateTime`, `string | number` for `Long`), and a variable
 * is that or a decoded value whose JSON form the scalar takes
 * (`string | Date` for `DateTime`). Keyed and ordered as
 * {@link scalarResolvers}.
 */
export const clientCodegenScalars: CodegenScalars = codegenScalarsFor(
	(schema) => ({
		input: union(typeOf(schema, 'input'), ...sendable(schema)),
		output: typeOf(schema, 'input'),
	}),
);
