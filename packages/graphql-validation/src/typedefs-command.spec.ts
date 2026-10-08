import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSchema, type GraphQLObjectType, graphql } from 'graphql';
import { constraintTypeDefs } from './constraint-directive';
import { DEFAULT_OUT, graphqls, main } from './typedefs-command';
import { withValidation } from './with-validation';

const SHIPPED = join(import.meta.dir, '../graphql/constraint.graphqls');

describe('the typedefs command', () => {
	const out = spyOn(process.stdout, 'write').mockImplementation(() => true);
	const err = spyOn(process.stderr, 'write').mockImplementation(() => true);
	afterEach(() => {
		out.mockClear();
		err.mockClear();
	});
	afterAll(() => {
		out.mockRestore();
		err.mockRestore();
	});

	test('prints the SDL, which declares @constraint as constraintTypeDefs does', async () => {
		expect(await main(['typedefs'])).toBe(0);
		const printed = String(out.mock.calls[0]?.[0]);
		expect(printed.endsWith(constraintTypeDefs)).toBe(true);
		expect(
			buildSchema(`${printed}\ntype Query { a: Int }`).getDirective(
				'constraint',
			),
		).toBeDefined();
	});

	test('writes it to --out, creating the folder', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'graphqls-'));
		try {
			const file = join(dir, 'schema/constraint.graphqls');
			expect(await main(['typedefs', '--out', file])).toBe(0);
			expect(await readFile(file, 'utf8')).toBe(graphqls());
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test('fails with 1 and one line when the file cannot be written', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'graphqls-'));
		try {
			expect(await main(['typedefs', '--out', dir])).toBe(1);
			expect(String(err.mock.calls[0]?.[0])).toStartWith('typedefs failed: ');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test('writes to generated/graphql/ when --out names no file', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'graphqls-'));
		const cwd = process.cwd();
		try {
			process.chdir(dir);
			expect(await main(['typedefs', '--out'])).toBe(0);
			expect(await readFile(join(dir, DEFAULT_OUT), 'utf8')).toBe(graphqls());
		} finally {
			process.chdir(cwd);
			await rm(dir, { recursive: true, force: true });
		}
	});

	test('answers --help or -h anywhere with 0', async () => {
		expect(await main(['--help'])).toBe(0);
		expect(await main(['typedefs', '--help'])).toBe(0);
		expect(await main(['typedefs', '--out', 'x', '-h'])).toBe(0);
	});

	test('refuses a usage error with 2', async () => {
		for (const argv of [
			[],
			['schema'],
			['typedefs', '--out', ''],
			['typedefs', '--out=x'],
			['typedefs', '--out', '--out'],
			['typedefs', '--out', 'a', 'b'],
			['typedefs', '-x'],
		]) {
			expect(await main(argv)).toBe(2);
		}
		expect(String(err.mock.calls[1]?.[0])).toStartWith(
			'Unknown command "schema".',
		);
	});
});

describe('graphql/constraint.graphqls, shipped in the package', () => {
	test('is what the command writes', async () => {
		if ((await readFile(SHIPPED, 'utf8')) !== graphqls()) {
			throw new Error(
				'graphql/constraint.graphqls is stale: run `bun run typedefs:write` in packages/graphql-validation.',
			);
		}
	});
});

describe('a schema whose scanned files include the generated copy', () => {
	test('declares @constraint without constraintTypeDefs, and withValidation checks it', async () => {
		const schema = buildSchema(
			`${await readFile(SHIPPED, 'utf8')}\ntype Query { echo(word: String! @constraint(maxLength: 3)): String }`,
		);
		const echo = (schema.getQueryType() as GraphQLObjectType).getFields()[
			'echo'
		];
		(echo as { resolve?: unknown }).resolve = (
			_: unknown,
			{ word }: { word: string },
		) => word;
		withValidation(schema);
		expect(await graphql({ schema, source: '{ echo(word: "abc") }' })).toEqual({
			data: { echo: 'abc' },
		});
		const refused = await graphql({ schema, source: '{ echo(word: "abcd") }' });
		expect(refused.errors?.[0]?.extensions['code']).toBe('BAD_USER_INPUT');
	});
});
