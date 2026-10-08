// A codegen setup holding the plugin and its options behind exported values
// whose types are inferred: a declaration build must name each one through
// `@nxgt/graphql-codegen-zod` and its peers alone (TS2883 otherwise).
import { type CodegenZodConfig, plugin } from '@nxgt/graphql-codegen-zod';
import { buildSchema } from 'graphql';

export const config = {
	scalarSchemas: '@nxgt/graphql-scalars',
	zodScalars: { Money: './money#moneySchema' },
} satisfies CodegenZodConfig;

export const output = plugin(
	buildSchema('type Query { a(n: Int): Int }'),
	[],
	config,
);
export const zod = { plugin };
