import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
	buildSchema,
	GraphQLInputObjectType,
	GraphQLInt,
	GraphQLNonNull,
	GraphQLObjectType,
	GraphQLSchema,
	parse,
} from 'graphql';
import { documents, ENDPOINT, schema } from '../test/fixture';
import { generated } from '../test/write-generated';
import { type CodegenMswConfig, plugin } from './index';

const base = {
	endpoint: ENDPOINT,
	schemasImport: './zod',
	typesImport: './graphql',
} satisfies CodegenMswConfig;

const of = (source: string) => [
	{ location: 'a.graphql', document: parse(source) },
];

describe('the generated files', () => {
	test('are what the plugins write', async () => {
		for (const [name, content] of Object.entries(await generated())) {
			const file = new URL(`../test/${name}.ts`, import.meta.url);
			if ((await readFile(file, 'utf8')) !== content) {
				throw new Error(
					`test/${name}.ts is stale: run \`bun run generated:write\` in packages/graphql-codegen-msw.`,
				);
			}
		}
	});
});

describe('plugin', () => {
	test('writes one handler per named query and mutation, none for a subscription or an anonymous operation', () => {
		const output = plugin(schema, documents, base);
		expect(
			[...output.matchAll(/^export function (\w+)/gm)].map((m) => m[1]),
		).toEqual(['mockUserQuery', 'mockUsersQuery', 'mockSignUpMutation']);
		expect(output).not.toContain('Joined');
	});

	test('names the types and schemas as typescript-operations and codegen-zod do', () => {
		const output = plugin(
			schema,
			of('query getUser($id: ID!) { user(id: $id) { id } }'),
			{
				...base,
				typesPrefix: 'I',
				typesSuffix: 'Type',
				schemaPrefix: 's',
			},
		);
		expect(output).toContain(
			'import type { IGetUserQueryType, IGetUserQueryVariablesType } from "./graphql";',
		);
		expect(output).toContain(
			'import { sIGetUserQueryVariablesType } from "./zod";',
		);
		expect(output).toContain('export function mockGetUserQuery(');
		expect(output).toContain(
			'resolver: GraphQLMockResolver<IGetUserQueryType, IGetUserQueryVariablesType>,',
		);
	});

	test('follows omitOperationSuffix and dedupeOperationSuffix', () => {
		const document = of('query UserQuery($id: ID!) { user(id: $id) { id } }');
		const omitted = plugin(schema, document, {
			...base,
			omitOperationSuffix: true,
		});
		expect(omitted).toContain('export function mockUserQuery(');
		expect(omitted).toContain(
			'GraphQLMockResolver<UserQuery, UserQueryVariables>',
		);
		const deduped = plugin(schema, document, {
			...base,
			dedupeOperationSuffix: true,
		});
		expect(deduped).toContain(
			'GraphQLMockResolver<UserQuery, UserQueryVariables>',
		);
		const kept = plugin(schema, document, base);
		expect(kept).toContain('export function mockUserQueryQuery(');
	});

	test('follows namingConvention', () => {
		const output = plugin(
			schema,
			of('query user_by_id($id: ID!) { user(id: $id) { id } }'),
			{
				...base,
				namingConvention: 'keep',
			},
		);
		expect(output).toContain('export function mockuser_by_idQuery(');
		expect(output).toContain('zuser_by_idQueryVariables');
	});

	test('takes types and schemas from one module when both options name it', () => {
		const output = plugin(
			schema,
			of('query User($id: ID!) { user(id: $id) { id } }'),
			{
				...base,
				typesImport: './zod',
			},
		);
		expect(output).toContain(
			'import { type UserQuery, type UserQueryVariables, zUserQueryVariables } from "./zod";',
		);
	});

	test('aliases an import whose name the file declares', () => {
		const output = plugin(schema, documents, {
			...base,
			invalidInput: './refusals#invalidInput',
		});
		expect(output).toContain(
			'import { invalidInput as invalidInput2 } from "./refusals";',
		);
		expect(output).toContain(
			'export const invalidInput: InvalidInput = invalidInput2;',
		);
	});

	test('writes the input types the variables reach, sorted, a field or an enum value per line, and each variable type', () => {
		const sdl = buildSchema(`
			input B { b: Int! = 1, a: A, self: B }
			input A @oneOf { x: ID, y: String }
			enum E { Y X }
			scalar S
			input Unused { u: Int }
			type Query { q(b: B, e: [E!], s: S): Int, none: Int }
		`);
		const output = plugin(
			sdl,
			of(
				'query Q($b: B, $e: [E!]! = [X], $s: S) { q(b: $b, e: $e, s: $s) } query None { none }',
			),
			base,
		);
		expect(output).toContain(
			[
				'const inputTypes: InputTypes = {',
				'\tA: {',
				'\t\tkind: "input",',
				'\t\tfields: {',
				'\t\t\tx: "ID",',
				'\t\t\ty: "String",',
				'\t\t},',
				'\t\toneOf: true,',
				'\t},',
				'\tB: {',
				'\t\tkind: "input",',
				'\t\tfields: {',
				'\t\t\tb: "Int! = 1",',
				'\t\t\ta: "A",',
				'\t\t\tself: "B",',
				'\t\t},',
				'\t},',
				'\tE: {',
				'\t\tkind: "enum",',
				'\t\tvalues: [',
				'\t\t\t"Y",',
				'\t\t\t"X",',
				'\t\t],',
				'\t},',
				'\tID: { kind: "builtin" },',
				'\tInt: { kind: "builtin" },',
				'\tS: { kind: "scalar" },',
				'\tString: { kind: "builtin" },',
				'};',
			].join('\n'),
		);
		expect(output).toContain(
			'variableTypes: { b: "B", e: "[E!]! = [X]", s: "S" }, inputTypes,',
		);
		expect(output).toContain('variableTypes: {}, inputTypes,');
		expect(output).not.toContain('Unused');
	});

	test("marks a default a schema built in code cannot print: a non-null field's is not required", () => {
		const input = new GraphQLInputObjectType({
			name: 'C',
			fields: { n: { type: new GraphQLNonNull(GraphQLInt), defaultValue: 2 } },
		});
		const coded = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: 'Query',
				fields: { q: { type: GraphQLInt, args: { c: { type: input } } } },
			}),
		});
		expect(plugin(coded, of('query Q($c: C) { q(c: $c) }'), base)).toContain(
			'\t\tfields: {\n\t\t\tn: "Int! = …",\n\t\t},',
		);
	});

	test('imports only what a file with no operation uses', () => {
		expect(plugin(schema, [], base)).toBe(
			[
				'import { type InvalidInput, invalidInputRefusal } from "@nxgt/graphql-codegen-msw/runtime";',
				'',
				"/** Where the client sends its operations; a handler's `options.endpoint` overrides it. */",
				`export const endpoint = "${ENDPOINT}";`,
				'',
				'/** How an invalid input is answered, without calling the resolver. */',
				'export const invalidInput: InvalidInput = invalidInputRefusal();',
				'',
			].join('\n'),
		);
	});

	test('writes the endpoint as given: a path msw matches on any origin', () => {
		expect(plugin(schema, [], { ...base, endpoint: '*/graphql' })).toContain(
			'export const endpoint = "*/graphql";',
		);
	});

	test('fails on two operations whose handlers share a name', () => {
		const twice = of(
			'query getUser($id: ID!) { user(id: $id) { id } } query GetUser($id: ID!) { user(id: $id) { id } }',
		);
		expect(() => plugin(schema, twice, base)).toThrow(
			'@nxgt/graphql-codegen-msw: the file would declare mockGetUserQuery twice: two operations give it the same name. Rename one of them.',
		);
	});
});
