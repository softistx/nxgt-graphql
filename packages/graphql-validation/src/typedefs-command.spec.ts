import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSchema } from 'graphql';
import { constraintTypeDefs } from './constraint-directive';
import { graphqls, main } from './typedefs-command';

const SHIPPED = join(import.meta.dir, '../graphql/constraint.graphqls');

describe('the typedefs command', () => {
	const out = spyOn(process.stdout, 'write').mockImplementation(() => true);
	const err = spyOn(process.stderr, 'write').mockImplementation(() => true);
	afterEach(() => {
		out.mockClear();
		err.mockClear();
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

	test('answers --help with 0, and nothing or a wrong command with 1', async () => {
		expect(await main(['--help'])).toBe(0);
		expect(await main([])).toBe(1);
		expect(await main(['schema'])).toBe(1);
		expect(await main(['typedefs', '--out'])).toBe(1);
		expect(String(err.mock.calls[0]?.[0])).toStartWith(
			'Unknown command "schema".',
		);
	});
});

describe('graphql/constraint.graphqls, shipped in the package', () => {
	test('is what the command writes: regenerate it with `bun run graphqls`', async () => {
		expect(await readFile(SHIPPED, 'utf8')).toBe(graphqls());
	});
});
