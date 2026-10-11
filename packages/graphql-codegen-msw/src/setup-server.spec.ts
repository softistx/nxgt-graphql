import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { $ } from 'bun';

/**
 * Node's version, when a Node that msw 3 runs on (22.12 or later) is on the
 * PATH. msw/node's setupServer intercepts nothing under Bun, so it is
 * proved under Node; without one this file is skipped, saying so.
 */
async function nodeVersion(): Promise<string | undefined> {
	const ran = await $`node --version`.quiet().nothrow();
	if (ran.exitCode !== 0) return undefined;
	const version = ran.stdout.toString().trim();
	const [major = 0, minor = 0] = version.slice(1).split('.').map(Number);
	return major > 22 || (major === 22 && minor >= 12) ? version : undefined;
}

const node = await nodeVersion();
if (!node)
	console.warn(
		'setup-server.spec.ts skipped: no Node 22.12 or later on the PATH to run msw/node.',
	);

describe.skipIf(!node)(`msw/node's setupServer, under Node ${node}`, () => {
	test('serves the generated handlers to real fetch requests', async () => {
		// Inside the package (its .cache/, ignored by git), so Node resolves
		// msw, graphql and this package itself as the specs do.
		const cache = new URL('../.cache', import.meta.url).pathname;
		await mkdir(cache, { recursive: true });
		const dir = await mkdtemp(join(cache, 'node-run-'));
		try {
			const built = await Bun.build({
				entrypoints: [
					new URL('../test/node-scenario.ts', import.meta.url).pathname,
				],
				outdir: dir,
				target: 'node',
				format: 'esm',
				packages: 'external',
			});
			expect(built.success).toBe(true);
			const ran = await $`node ${join(dir, 'node-scenario.js')}`
				.quiet()
				.nothrow();
			expect(ran.stderr.toString()).toBe('');
			const results = JSON.parse(ran.stdout.toString());
			expect(results.data).toEqual({
				status: 200,
				body: { data: { user: { id: 'u_1', name: 'Ada', joined: null } } },
			});
			expect(results.invalidInput.status).toBe(400);
			expect(results.invalidInput.body.errors[0].extensions).toEqual({
				code: 'validation.errors.invalid-input',
				http: { status: 400 },
				fields: [
					{
						path: 'person.firstName',
						code: 'validation.errors.too_small',
						message: 'validation.errors.too_small',
						params: { min: 2 },
					},
				],
			});
			expect(results.badUserInput.status).toBe(200);
			expect(results.badUserInput.body.errors[0].extensions.code).toBe(
				'BAD_USER_INPUT',
			);
			expect(results.own.status).toBe(422);
			expect(results.own.body.errors[0].message).toBe('Users refused');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}, 30_000);
});
