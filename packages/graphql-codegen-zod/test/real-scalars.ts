// Every scalar of @nxgt/graphql-scalars, alone and in a list, generated
// against its real scalarSchemas record: `test/generated-scalars.ts` is
// what the plugin writes for it, typechecked with the package.
import { scalarResolvers, scalarTypeDefs } from '@nxgt/graphql-scalars';
import { buildSchema, parse } from 'graphql';
import { plugin } from '../src/index';

const names = Object.keys(scalarResolvers);

/** `DateTime` → `dateTime`, `UUID` → `uuid`, `IPv4` → `ipv4`. */
export function fieldOf(name: string): string {
	return name.replace(/^[A-Z]+(?=[A-Z][a-z]|$)|^[A-Z]/, (head) =>
		head.toLowerCase(),
	);
}

export const sdl = `${scalarTypeDefs}
input AllScalars {
${names.map((name) => `\t${fieldOf(name)}: ${name}\n\t${fieldOf(name)}List: [${name}!]`).join('\n')}
}
type Query { all(input: AllScalars!): Boolean }
`;

export const schema = buildSchema(sdl);

export const documents = [
	{
		location: 'all.graphql',
		document: parse('query All($input: AllScalars!) { all(input: $input) }'),
	},
];

export function generatedScalars(): Promise<string> {
	return plugin(
		schema,
		documents,
		{ scalarSchemas: '@nxgt/graphql-scalars' },
		{ outputFile: 'test/generated-scalars.ts' },
	);
}
