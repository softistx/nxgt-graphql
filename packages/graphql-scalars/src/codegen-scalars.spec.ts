import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
// TypeScript 6's compiler API, pinned under an alias: the `typescript` peer
// also allows 7, which has no compiler API, and the newest-peers job runs it.
import ts from 'typescript-api';
import {
	type CodegenScalars,
	clientCodegenScalars,
	codegenScalars,
} from './codegen-scalars';
import { scalarResolvers } from './scalars';

/**
 * The type tsc gives `z.input` and `z.output` of every scalar's schema, as
 * text: one probe over `ScalarName`, so a scalar added later is read too,
 * with no list to keep. The probe is served from memory, as if it sat beside
 * this file where `zod` resolves; a probe tsc reports an error on fails.
 */
function typesFromTsc(): Record<string, { wire: string; decoded: string }> {
	const probe = join(import.meta.dir, 'codegen-probe.ts');
	const text = `import type { z } from 'zod';
import type { ScalarName, ScalarSchemas } from './scalars';
export type Wire = { [N in ScalarName]: z.input<ScalarSchemas[N]> };
export type Decoded = { [N in ScalarName]: z.output<ScalarSchemas[N]> };
`;
	const options: ts.CompilerOptions = {
		strict: true,
		exactOptionalPropertyTypes: true,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		target: ts.ScriptTarget.ESNext,
		types: [],
		noEmit: true,
	};
	const host = ts.createCompilerHost(options);
	const { fileExists, readFile, getSourceFile } = host;
	host.fileExists = (path) => path === probe || fileExists(path);
	host.readFile = (path) => (path === probe ? text : readFile(path));
	host.getSourceFile = (path, version, ...rest) =>
		path === probe
			? ts.createSourceFile(path, text, version)
			: getSourceFile(path, version, ...rest);
	const program = ts.createProgram([probe], options, host);
	const errors = ts.getPreEmitDiagnostics(program);
	if (errors.length > 0) {
		throw new Error(
			ts.flattenDiagnosticMessageText(errors[0]?.messageText ?? '', '\n'),
		);
	}
	const checker = program.getTypeChecker();
	const file = program.getSourceFile(probe);
	if (!file) throw new Error('the probe did not load');
	const alias: Record<string, ts.Type> = {};
	ts.forEachChild(file, (node) => {
		if (ts.isTypeAliasDeclaration(node)) {
			alias[node.name.text] = checker.getTypeAtLocation(node);
		}
	});
	const print = (of: ts.Type | undefined, name: string) => {
		const symbol = of && checker.getPropertyOfType(of, name);
		if (!symbol) throw new Error(`tsc has no type for ${name}`);
		return checker.typeToString(
			checker.getTypeOfSymbolAtLocation(symbol, file),
			undefined,
			ts.TypeFormatFlags.NoTruncation,
		);
	};
	const names = alias['Wire']
		? checker.getPropertiesOfType(alias['Wire']).map((p) => p.name)
		: [];
	return Object.fromEntries(
		names.map((name) => [
			name,
			{
				wire: print(alias['Wire'], name),
				decoded: print(alias['Decoded'], name),
			},
		]),
	);
}

const fromTsc = typesFromTsc();

/** The members of a union type's text, once each, sorted: order is not meaning. */
function members(type: string): string[] {
	return [...new Set(type.split(' | '))].sort();
}

describe('codegenScalars and clientCodegenScalars', () => {
	test('hold every scalar, keyed and ordered as scalarResolvers', () => {
		const names = Object.keys(scalarResolvers);
		expect(Object.keys(codegenScalars)).toEqual(names);
		expect(Object.keys(clientCodegenScalars)).toEqual(names);
		expect(Object.keys(fromTsc).sort()).toEqual([...names].sort());
	});

	test('give a server z.output in, and z.output or z.input out, as tsc types them', () => {
		for (const [name, { wire, decoded }] of Object.entries(fromTsc)) {
			const entry = codegenScalars[name as keyof CodegenScalars];
			expect([name, entry.input]).toEqual([name, decoded]);
			expect([name, members(entry.output)]).toEqual([
				name,
				members(`${decoded} | ${wire}`),
			]);
		}
	});

	test('give a client z.input out, and in z.input or a Date the scalar takes as JSON', () => {
		for (const [name, { wire }] of Object.entries(fromTsc)) {
			const entry = clientCodegenScalars[name as keyof CodegenScalars];
			expect([name, entry.output]).toEqual([name, wire]);
			const extra = members(entry.input).filter(
				(type) => !members(wire).includes(type),
			);
			const scalar = scalarResolvers[name as keyof typeof scalarResolvers];
			const takesDate = (() => {
				try {
					scalar.parseValue(JSON.parse(JSON.stringify(new Date(0))));
					return true;
				} catch {
					return false;
				}
			})();
			expect([name, extra]).toEqual([
				name,
				takesDate &&
				members(codegenScalars[name as keyof CodegenScalars].input).includes(
					'Date',
				)
					? ['Date']
					: [],
			]);
		}
	});

	test('decode the codecs, and leave the rest as they cross', () => {
		expect(codegenScalars.DateTime).toEqual({
			input: 'Date',
			output: 'Date | string',
		});
		expect(clientCodegenScalars.DateTime).toEqual({
			input: 'string | Date',
			output: 'string',
		});
		expect(codegenScalars.Long).toEqual({
			input: 'bigint',
			output: 'bigint | string | number',
		});
		expect(clientCodegenScalars.Long).toEqual({
			input: 'string | number',
			output: 'string | number',
		});
		expect(clientCodegenScalars.Timestamp.input).toBe('number');
		expect(codegenScalars.JSON.input).toBe('unknown');
		expect(codegenScalars.Void.input).toBe('null');
	});
});
