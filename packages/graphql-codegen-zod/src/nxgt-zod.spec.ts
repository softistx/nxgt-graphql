import { describe, expect, test } from 'bun:test';
import { scalarSchemas as fromScalars } from '@nxgt/graphql-scalars';
import { scalarSchemas as fromZod } from '@nxgt/zod';
import { documents, generatedScalars, schema } from '../test/real-scalars';
import { plugin } from './index';

/** Values of every shape, valid for some scalars and not for others. */
const PROBES: unknown[] = [
	'',
	'a',
	'2020-01-01T00:00:00Z',
	'2020-01-01T00:00:00',
	'2020-01-01',
	'12:30:00',
	'12:30:00Z',
	'P1D',
	'Europe/Paris',
	'+02:00',
	'fr-FR',
	'FR',
	'EUR',
	'FR1420041010050500013M02606',
	'#fff',
	'rgb(0, 0, 0)',
	'rgba(0, 0, 0, 1)',
	'hsl(0, 0%, 0%)',
	'hsla(0, 0%, 0%, 1)',
	'127.0.0.1',
	'::1',
	'10.0.0.0/8',
	'2001:db8::/32',
	'01:23:45:67:89:ab',
	'a@b.co',
	'https://example.com',
	'+33612345678',
	'example.com',
	'f47ac10b-58cc-4372-a567-0e02b2c3d479',
	'0190163d-8694-739b-aea5-966c26f8ad91',
	'9m4e2mr0ui3e8a215n4g',
	'V1StGXR8_Z5jdHi6B-myT',
	'9783161484100',
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln',
	'a'.repeat(64),
	'a'.repeat(128),
	'01ARZ3NDEKTSV4RRFFQ69G5FAV',
	'507f1f77bcf86cd799439011',
	'1.2.3',
	'9007199254740993',
	'123456789012345678901234567890',
	'aGVsbG8=',
	'deadbeef',
	'😀',
	0,
	1,
	-1,
	1.5,
	-1.5,
	2 ** 31,
	9007199254740993n,
	true,
	null,
	{ a: [1, 'b'] },
	[1],
];

describe('scalarSchemas from @nxgt/zod, for a client', () => {
	test('holds the same scalars as @nxgt/graphql-scalars', () => {
		expect(Object.keys(fromZod)).toEqual(Object.keys(fromScalars));
	});

	test('has a probe each scalar takes, so no scalar is only refused', () => {
		const untaken = Object.entries(fromScalars)
			.filter(([, schema]) => !PROBES.some((p) => schema.safeParse(p).success))
			.map(([name]) => name);
		expect(untaken).toEqual([]);
	});

	test('takes, refuses and decodes every probe as @nxgt/graphql-scalars does', () => {
		for (const name of Object.keys(
			fromScalars,
		) as (keyof typeof fromScalars)[]) {
			for (const probe of PROBES) {
				const server = fromScalars[name].safeParse(probe);
				const client = fromZod[name].safeParse(probe);
				expect([name, probe, client.success]).toEqual([
					name,
					probe,
					server.success,
				]);
				if (server.success) expect(client.data).toEqual(server.data);
			}
		}
	});

	test('generates the same file, importing @nxgt/zod', async () => {
		const generated = await plugin(
			schema,
			documents,
			{ scalarSchemas: '@nxgt/zod' },
			{ outputFile: 'test/generated-scalars.ts' },
		);
		expect(generated).toBe(
			(await generatedScalars()).replace(
				'from "@nxgt/graphql-scalars"',
				'from "@nxgt/zod"',
			),
		);
	});
});
