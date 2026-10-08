// Writes test/generated.ts and test/generated-scalars.ts:
// `bun run generated:write`.
import { plugin } from '../src/index';
import { documents, schema } from './fixture';
import { generatedScalars } from './real-scalars';

export const config = { scalarSchemas: './scalars' };

export function generated(): Promise<string> {
	return plugin(schema, documents, config, { outputFile: 'test/generated.ts' });
}

if (import.meta.main) {
	await Bun.write(
		new URL('./generated.ts', import.meta.url),
		await generated(),
	);
	await Bun.write(
		new URL('./generated-scalars.ts', import.meta.url),
		await generatedScalars(),
	);
}
