import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { constraintTypeDefs, withValidation } from '@nxgt/graphql-validation';
import {
	buildClientSchema,
	buildSchema,
	type GraphQLScalarType,
	graphql,
	introspectionFromSchema,
	parse,
} from 'graphql';
import type { z } from 'zod';
import { documents, sdl } from '../test/fixture';
import * as generatedModule from '../test/generated';
import { scalarSchemas } from '../test/scalars';
import { generated } from '../test/write-generated';
import { type CodegenZodConfig, plugin } from './index';

const GENERATED = new URL('../test/generated.ts', import.meta.url);
const schemas = generatedModule as unknown as Record<string, z.ZodType>;

/** What each resolver of the served schema last received, by field. */
const received = new Map<string, unknown>();

/** The fixture's schema served behind withValidation, resolvers answering. */
function server() {
	const schema = buildSchema(sdl);
	// DateTime decodes as a server with @nxgt/graphql-scalars does.
	// graphql 17 reads coerceInputValue, graphql 16 parseValue.
	const dateTime = schema.getType('DateTime') as GraphQLScalarType & {
		coerceInputValue?: (value: unknown) => unknown;
	};
	const decode = (value: unknown) => scalarSchemas.DateTime.parse(value);
	dateTime.parseValue = decode;
	dateTime.coerceInputValue = decode;
	const answers: Record<string, unknown> = {
		user: { id: 'u_1', name: 'n' },
		users: [],
		reach: true,
		signUp: { id: 'u_1', name: 'n' },
		rate: true,
	};
	for (const root of [schema.getQueryType(), schema.getMutationType()]) {
		for (const field of Object.values(root?.getFields() ?? {})) {
			field.resolve = (_source, args) => {
				received.set(field.name, args);
				return answers[field.name];
			};
		}
	}
	return withValidation(schema);
}

const source = documents[0]?.document.loc?.source.body ?? '';

describe('the generated file', () => {
	test('is what the plugin writes', async () => {
		if ((await readFile(GENERATED, 'utf8')) !== (await generated())) {
			throw new Error(
				'test/generated.ts is stale: run `bun run generated:write` in packages/graphql-codegen-zod.',
			);
		}
	});

	test('refuses on the client what the server refuses, operation by operation', async () => {
		const served = server();
		const cases: [string, string, Record<string, unknown>][] = [
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al' } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'nope', name: 'Al' } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'A' } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', age: 12 } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', tags: [] } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', tags: 'toolongtag' } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{
					input: {
						email: 'a@b.co',
						name: 'Al',
						prefs: { dates: '2020-01-01T00:00:00Z' },
					},
				},
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', prefs: { dates: 'nope' } } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', address: { street: 'S' } } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{
					input: {
						email: 'a@b.co',
						name: 'Al',
						address: { street: 'Main', zip: '7500' },
					},
				},
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{
					input: {
						email: 'a@b.co',
						name: 'Al',
						role: 'ADMIN',
						birth: '2020-01-01T00:00:00Z',
					},
				},
			],
			['User', 'zUserQueryVariables', { id: 'abc' }],
			['User', 'zUserQueryVariables', { id: 'ab' }],
			['Users', 'zUsersQueryVariables', {}],
			['Users', 'zUsersQueryVariables', { name: 'nick', first: 50 }],
			['Users', 'zUsersQueryVariables', { name: 'bob' }],
			['Users', 'zUsersQueryVariables', { first: 0 }],
			['Rate', 'zRateMutationVariables', { score: 1.5, id: 'abc' }],
			['Rate', 'zRateMutationVariables', { score: 1.2, id: 'abc' }],
			['Rate', 'zRateMutationVariables', { score: 1, id: 'a' }],
			// graphql refuses a field the input type does not define.
			[
				'SignUp',
				'zSignUpMutationVariables',
				{ input: { email: 'a@b.co', name: 'Al', extra: 1 } },
			],
			[
				'SignUp',
				'zSignUpMutationVariables',
				{
					input: {
						email: 'a@b.co',
						name: 'Al',
						prefs: { tags: ['ab'], grid: [[1, null]] },
					},
				},
			],
			['Reach', 'zReachQueryVariables', { c: { email: 'a@b.co' } }],
			['Reach', 'zReachQueryVariables', { c: { phone: '123' } }],
			[
				'Reach',
				'zReachQueryVariables',
				{ c: { email: 'a@b.co', phone: '123456' } },
			],
			['Reach', 'zReachQueryVariables', { c: {} }],
			['ReachEmail', 'zReachEmailQueryVariables', { e: 'a@b.co' }],
			['ReachEmail', 'zReachEmailQueryVariables', { e: 'nope' }],
		];
		for (const [operationName, schema, variableValues] of cases) {
			const result = await graphql({
				schema: served,
				source,
				operationName,
				variableValues,
			});
			const client = schemas[schema]?.safeParse(variableValues).success;
			expect([operationName, variableValues, client]).toEqual([
				operationName,
				variableValues,
				result.errors === undefined,
			]);
		}
	});

	test('parses arguments into what the resolver receives', async () => {
		const served = server();
		const sent = {
			input: { email: 'a@b.co', name: 'Al', address: { street: 'Main' } },
		};
		await graphql({
			schema: served,
			source,
			operationName: 'SignUp',
			variableValues: sent,
		});
		expect(received.get('signUp')).toEqual(
			schemas['zMutationSignUpArgs']?.parse(sent),
		);
		await graphql({
			schema: served,
			source,
			operationName: 'Users',
			variableValues: {},
		});
		expect(received.get('users')).toEqual(
			schemas['zQueryUsersArgs']?.parse({
				filter: { and: [{}] },
				first: 5,
			}),
		);
	});

	test('is stricter than graphql on one coercion, on purpose: an Int for an ID', async () => {
		const result = await graphql({
			schema: server(),
			source,
			operationName: 'User',
			variableValues: { id: 12345 },
		});
		expect(result.errors).toBeUndefined();
		expect(
			schemas['zUserQueryVariables']?.safeParse({ id: 12345 }).success,
		).toBe(false);
	});

	test('takes a single value for a list of scalars, as graphql does', async () => {
		const served = server();
		const input = {
			email: 'a@b.co',
			name: 'Al',
			tags: 'ok',
			prefs: { grid: 1 },
		};
		const result = await graphql({
			schema: served,
			source,
			operationName: 'SignUp',
			variableValues: { input },
		});
		expect(result.errors).toBeUndefined();
		const parsed = schemas['zMutationSignUpArgs']?.parse({ input });
		expect(received.get('signUp')).toEqual(parsed);
		// A single value a rule refuses: the client's issue is the server's,
		// same path, same message.
		const refused = { ...input, tags: 'toolongtag' };
		const answer = await graphql({
			schema: served,
			source,
			operationName: 'SignUp',
			variableValues: { input: refused },
		});
		const client = schemas['zSignUpMutationVariables']?.safeParse({
			input: refused,
		});
		const issue = client?.error?.issues[0];
		const issues = answer.errors?.[0]?.extensions['issues'] as
			| readonly { readonly message: string }[]
			| undefined;
		expect([issue?.path, issue?.message]).toEqual([
			['input', 'tags', 0],
			issues?.[0]?.message,
		]);
		expect(issue?.message).toBeDefined();
	});

	test('types the arguments a resolver receives: the server parses them through the same rules', () => {
		expect(schemas['zQueryUsersArgs']?.parse({})).toEqual({ first: 10 });
		expect(
			schemas['zMutationSignUpArgs']?.parse({
				input: { email: 'a@b.co', name: 'Al' },
			}),
		).toEqual({
			input: {
				email: 'a@b.co',
				name: 'Al',
				role: 'USER',
				prefs: { tags: ['x'], grid: [[1]], owner: '7', ids: ['1'] },
				tags: ['new'],
			},
		});
		expect(schemas['zContact']?.safeParse({ email: 'a@b.co' }).success).toBe(
			true,
		);
		expect(
			schemas['zContact']?.safeParse({ email: 'a@b.co', phone: '123456' })
				.success,
		).toBe(false);
		expect(
			schemas['zFilter']?.safeParse({ and: [{ and: [{ name: 'x' }] }] })
				.success,
		).toBe(false);
	});
});

const tiny = (body: string) => buildSchema(`${constraintTypeDefs}\n${body}`);

describe('plugin', () => {
	test('refuses a schema withValidation refuses, with its message', async () => {
		const schema = tiny(
			'type Query { a(n: Int @constraint(minLength: 1)): Int }',
		);
		await expect(plugin(schema, [])).rejects.toThrow(
			'@constraint(minLength) on Query.a(n:) needs a String or an ID, not Int.',
		);
	});

	test('fails on a custom scalar it cannot map, naming it', async () => {
		const schema = tiny('scalar Money\ntype Query { a(m: Money): Int }');
		await expect(plugin(schema, [])).rejects.toThrow(
			'@nxgt/graphql-codegen-zod: the scalar Money is not in scalars, and no scalarSchemas is set.',
		);
		await expect(
			plugin(schema, [], { scalars: { Money: 'moneySchema' } }),
		).rejects.toThrow("write it '<module>#<export>'");
	});

	test('imports a mapped scalar, aliasing two exports of one name', async () => {
		const schema = tiny(
			'scalar Money\nscalar Cost\ninput I { m: Money!, c: Cost! }\ntype Query { a: Int }',
		);
		const out = await plugin(schema, [], {
			scalars: { Money: './money#schema', Cost: './cost#schema' },
		});
		expect(out).toContain('import { schema } from "./money";');
		expect(out).toContain('import { schema as schema2 } from "./cost";');
		expect(out).toContain('\tm: schema,\n\tc: schema2,');
	});

	test('checks a scalar against the scalarSchemas record when it can load it', async () => {
		const schema = tiny(
			'scalar DateTime\nscalar Money\ninput I { d: DateTime, m: Money }\ntype Query { a: Int }',
		);
		await expect(
			plugin(
				schema,
				[],
				{ scalarSchemas: './scalars.ts' },
				{ outputFile: 'test/out.ts' },
			),
		).rejects.toThrow(
			"the scalar Money is neither in scalars nor in ./scalars.ts's scalarSchemas",
		);
	});

	test('names as the typescript plugins do, honouring their options', async () => {
		const schema = tiny(
			'input sign_upInput { a: Int }\ntype Query { find_user(x: Int): Int }',
		);
		const operations = [
			{ document: parse('query findUserQuery($x: Int) { find_user(x: $x) }') },
		];
		const out = await plugin(schema, operations, {});
		expect(out).toContain('export const zSign_UpInput = ');
		expect(out).toContain('export type QueryFind_UserArgs = ');
		expect(out).toContain('export type FindUserQueryQueryVariables = ');
		const custom = await plugin(schema, operations, {
			namingConvention: 'keep',
			typesPrefix: 'I',
			schemaPrefix: 'schema',
			addUnderscoreToArgsType: true,
			dedupeOperationSuffix: true,
		});
		expect(custom).toContain('export const schemaIsign_upInput = ');
		expect(custom).toContain('export type IQuery_find_userArgs = ');
		expect(custom).toContain('export type IfindUserQueryVariables = ');
	});

	test('writes nothing for an anonymous operation', async () => {
		const out = await plugin(tiny('type Query { a: Int }'), [
			{ document: parse('{ a }') },
		]);
		expect(out).not.toContain('Variables');
	});
});

test('imports from zod on its one line', async () => {
	const schema = tiny(
		'scalar UUID\ninput I { id: UUID }\ntype Query { a: Int }',
	);
	const out = await plugin(schema, [], { scalars: { UUID: 'zod#uuidSchema' } });
	expect(out.startsWith('import { z, uuidSchema } from "zod";\n\n')).toBe(true);
});

describe('plugin, refusing what it cannot write faithfully', () => {
	test('a variable passed to two formats', async () => {
		const schema = tiny(
			'type Query { e(v: String @constraint(format: "email")): Int, u(v: String @constraint(format: "uuid")): Int }',
		);
		const operations = [
			{ document: parse('query Both($v: String) { e(v: $v) u(v: $v) }') },
		];
		await expect(plugin(schema, operations)).rejects.toThrow(
			'@nxgt/graphql-codegen-zod: Both($v:) is passed to Query.e(v:) (format: "email") and to Query.u(v:) (format: "uuid"), whose schemas cannot both apply. Use one variable for each.',
		);
	});

	test('an introspected schema that declares @constraint', async () => {
		const schema = buildClientSchema(
			introspectionFromSchema(
				tiny('type Query { a(n: Int @constraint(min: 1)): Int }'),
			),
		);
		await expect(plugin(schema, [])).rejects.toThrow(
			"@nxgt/graphql-codegen-zod: the schema declares @constraint, but Query has no SDL to read it from (an introspected schema?). Point codegen's schema at the SDL files.",
		);
	});

	test('keeps an introspected default when there is no @constraint', async () => {
		const schema = buildClientSchema(
			introspectionFromSchema(
				buildSchema('type Query { a(n: [Int] = 1): Int }'),
			),
		);
		expect(await plugin(schema, [])).toContain(
			'n: z.union([z.array(z.number().int().nullish()), z.number().int().transform((value): unknown[] => [value]).pipe(z.array(z.number().int().nullish()))]).prefault([1]).nullable(),',
		);
	});
});

describe('plugin, naming', () => {
	const schema = tiny(
		'input sign_upInput { a: Int }\ntype Query { find_user(x: Int): Int }',
	);
	const name = async (
		namingConvention: NonNullable<CodegenZodConfig['namingConvention']>,
	) =>
		(await plugin(schema, [], { namingConvention })).match(
			/export type (\w+) /,
		)?.[1];

	test('reads namingConvention in every form the typescript plugins take', async () => {
		expect(await name('change-case-all#camelCase')).toBe('sign_upInput');
		expect(await name({ typeNames: 'keep' })).toBe('sign_upInput');
		expect(await name({ enumValues: 'keep' })).toBe('Sign_UpInput');
		expect(await name({ transformUnderscore: true })).toBe('SignUpInput');
		expect(await name({ typeNames: 'change-case-all#pascalCase' })).toBe(
			'SignUpInput',
		);
		expect(
			await name({
				typeNames: 'change-case-all#pascalCase',
				transformUnderscore: false,
			}),
			// As upstream: with typeNames, transformUnderscore is not read.
		).toBe('SignUpInput');
		expect(await name('change-case-all#constantCase')).toBe('SIGN_UP_INPUT');
		await expect(name('my-module#myCase')).rejects.toThrow(
			'@nxgt/graphql-codegen-zod: namingConvention "my-module#myCase" is not one this plugin reads.',
		);
	});

	test('gives no import a name the file declares', async () => {
		const out = await plugin(
			tiny('scalar Money\ninput money { m: Money }\ntype Query { a: Int }'),
			[],
			{
				schemaPrefix: '',
				namingConvention: 'keep',
				scalars: { Money: './money#money' },
			},
		);
		expect(out).toContain('import { money as money2 } from "./money";');
		expect(out).toContain(
			'export const money = z.strictObject({\n\tm: money2.nullish(),',
		);
	});
});
