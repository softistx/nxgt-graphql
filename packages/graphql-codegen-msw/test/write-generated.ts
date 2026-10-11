// Writes the generated files beside it: `bun run generated:write`.
//   zod.ts      @nxgt/graphql-codegen-zod's schemas, the variables checked
//   graphql.ts  typescript-operations' result and variables types
//   msw*.ts     this plugin's handlers, one file per invalidInput choice

import { plugin as operationsPlugin } from '@graphql-codegen/typescript-operations';
import { plugin as zodPlugin } from '@nxgt/graphql-codegen-zod';
import { type CodegenMswConfig, plugin } from '../src/index';
import { documents, ENDPOINT, schema } from './fixture';

/** The options every msw file shares. */
const base = {
	endpoint: ENDPOINT,
	schemasImport: './zod',
	typesImport: './graphql',
} satisfies CodegenMswConfig;

/** Each generated msw file, by name, and its config. */
export const variants = {
	msw: base,
	'msw-translate': { ...base, translate: './i18n#translate' },
	'msw-bad-user-input': { ...base, invalidInput: 'bad-user-input' },
	'msw-own': { ...base, invalidInput: './invalid-input#invalidInput' },
} satisfies Record<string, CodegenMswConfig>;

/** Every generated file, by name, and what it should hold. */
export async function generated(): Promise<Record<string, string>> {
	const files: Record<string, string> = {
		zod: await zodPlugin(
			schema,
			documents,
			{ zodScalars: { DateTime: './scalars#dateTimeSchema' } },
			{ outputFile: 'test/zod.ts' },
		),
		graphql: await operations(),
	};
	for (const [name, config] of Object.entries(variants))
		files[name] = plugin(schema, documents, config);
	return files;
}

async function operations(): Promise<string> {
	const output = await operationsPlugin(schema, documents, {
		scalars: { DateTime: 'string' },
	});
	if (typeof output === 'string') return output;
	return `${[...(output.prepend ?? []), output.content].join('\n')}\n`;
}

if (import.meta.main) {
	for (const [name, content] of Object.entries(await generated()))
		await Bun.write(new URL(`./${name}.ts`, import.meta.url), content);
}
