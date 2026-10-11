import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'graphql';
import { schema } from '../test/fixture';
import { type CodegenMswConfig, plugin } from './index';

const base = {
	endpoint: 'https://api.example.com/graphql',
	schemasImport: './zod',
	typesImport: './graphql',
} satisfies CodegenMswConfig;

/** `base` without one option. */
function without(option: keyof typeof base): CodegenMswConfig {
	const { [option]: _, ...rest } = base;
	return rest;
}

const twice = [
	{
		location: 'a.graphql',
		document: parse(
			'query getUser($id: ID!) { user(id: $id) { id } } query GetUser($id: ID!) { user(id: $id) { id } }',
		),
	},
];

/** Each config the plugin refuses, and the message it refuses it with. */
const refusals: [string, CodegenMswConfig, string][] = [
	[
		'no endpoint',
		without('endpoint'),
		"@nxgt/graphql-codegen-msw: endpoint is not set; set it to the URL your client sends its operations to, e.g. endpoint: 'https://api.example.com/graphql', or a path msw matches on any origin: '*/graphql'.",
	],
	[
		'a blank endpoint',
		{ ...base, endpoint: ' ' },
		"@nxgt/graphql-codegen-msw: endpoint is not set; set it to the URL your client sends its operations to, e.g. endpoint: 'https://api.example.com/graphql', or a path msw matches on any origin: '*/graphql'.",
	],
	[
		'no schemasImport',
		without('schemasImport'),
		"@nxgt/graphql-codegen-msw: schemasImport is not set; point it at the file @nxgt/graphql-codegen-zod writes, as this file imports it, e.g. schemasImport: './zod'.",
	],
	[
		'no typesImport',
		without('typesImport'),
		"@nxgt/graphql-codegen-msw: typesImport is not set; point it at the module that exports each operation's result and variables types, as this file imports it: './graphql' for the client preset, or the file typescript-operations writes.",
	],
	[
		'an invalidInput that is neither a choice nor module#export',
		{ ...base, invalidInput: 'invalidInput' },
		"@nxgt/graphql-codegen-msw: invalidInput is \"invalidInput\"; write 'invalid-input', 'bad-user-input' or '<module>#<export>', e.g. './invalid-input#invalidInput'.",
	],
	[
		'a translate that is not module#export',
		{ ...base, translate: './i18n' },
		"@nxgt/graphql-codegen-msw: translate is \"./i18n\"; write '<module>#<export>', e.g. './i18n#translate'.",
	],
	[
		'translate beside another invalidInput',
		{ ...base, invalidInput: 'bad-user-input', translate: './i18n#translate' },
		'@nxgt/graphql-codegen-msw: translate words the default invalidInput\'s messages only, and invalidInput is "bad-user-input". Remove translate, or translate inside your own function.',
	],
	[
		'an unknown namingConvention',
		{ ...base, namingConvention: 'my-module#myCase' },
		"@nxgt/graphql-codegen-msw: namingConvention \"my-module#myCase\" is not one this plugin reads. Use 'keep', a function, or 'change-case-all#<case>' with one of camelCase, capitalCase, constantCase, dotCase, headerCase, noCase, paramCase, pascalCase, pathCase, sentenceCase, snakeCase, lowerCase, upperCase, lowerCaseFirst, upperCaseFirst.",
	],
];

/** The messages raised elsewhere: the plugin's duplicate, the runtime's iterator. */
const elsewhere = [
	'@nxgt/graphql-codegen-msw: the file would declare mockGetUserQuery twice: two operations give it the same name. Rename one of them.',
	"@nxgt/graphql-codegen-msw: the resolver of User returned an iterator (a generator function?). Each request's variables are checked before the resolver runs, which msw cannot do once it keeps an iterator: answer each request from a plain function, or register one handler per answer with { once: true }.",
];

describe('the config', () => {
	for (const [what, config, message] of refusals) {
		test(`refuses ${what}`, () => {
			expect(() => plugin(schema, [], config)).toThrow(message);
		});
	}

	test("takes 'invalid-input', 'bad-user-input' and module#export", () => {
		for (const invalidInput of [
			'invalid-input',
			'bad-user-input',
			'./refusals#refuse',
			'@acme/mocks#refuse',
		])
			expect(() => plugin(schema, [], { ...base, invalidInput })).not.toThrow();
	});

	test('the duplicate message is the one the troubleshooting page lists', () => {
		expect(() => plugin(schema, twice, base)).toThrow(elsewhere[0]);
	});
});

describe('docs/troubleshooting.md', () => {
	test('has an entry headed by each message', async () => {
		const page = await readFile(
			new URL('../docs/troubleshooting.md', import.meta.url),
			'utf8',
		);
		const messages = new Set([
			...refusals.map(([, , message]) => message),
			...elsewhere,
		]);
		const missing = [...messages].filter(
			(message) => !page.includes(`### \`${message}\``),
		);
		expect(missing).toEqual([]);
	});
});
