import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	spyOn,
	test,
} from 'bun:test';
import { GraphQLError } from 'graphql';
import { HttpResponse } from 'msw';
import { ENDPOINT } from '../test/fixture';
import { iteratorMessage } from '../test/iterator-message';
import * as defaults from '../test/msw';
import * as badUserInput from '../test/msw-bad-user-input';
import * as own from '../test/msw-own';
import * as translated from '../test/msw-translate';
import { setupFetchNetwork } from '../test/network';
import { zUsersQueryVariables } from '../test/zod';
import { fieldsError, type InvalidInput, mockOperation } from './runtime';

// The generated handlers, served by msw's network in this process: every
// request is a real fetch, answered by the handler the spec registers.
// `setup-server.spec.ts` runs msw/node's setupServer under Node.
const server = setupFetchNetwork();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const USER = 'query User($id: ID!) { user(id: $id) { id name joined } }';
const USERS =
	'query Users($first: Int, $role: Role) { users(first: $first, role: $role) { id } }';
const SIGN_UP =
	'mutation SignUp($input: SignUpInput!) { signUp(input: $input) { id name } }';

/** Posts one operation to `url`; the status and the parsed body. */
async function post(
	query: string,
	variables: Record<string, unknown>,
	url = ENDPOINT,
	accept?: string,
): Promise<{ status: number; body: { data?: unknown; errors?: unknown } }> {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(accept ? { accept } : {}),
		},
		body: JSON.stringify({ query, variables }),
	});
	return { status: response.status, body: await response.json() };
}

/** A resolver that records each call, then answers `data`. */
function answering(data: Record<string, unknown>) {
	const calls: unknown[] = [];
	const resolver = ({ variables }: { variables: unknown }) => {
		calls.push(variables);
		// Any data: each test reads the wire, not the types.
		return HttpResponse.json({ data }) as never;
	};
	return { calls, resolver };
}

const ada = { user: { id: 'u_1', name: 'Ada', joined: null } };
const validSignUp = {
	input: { person: { firstName: 'Ada', email: 'ada@example.com' } },
};
const invalidSignUp = {
	input: { person: { firstName: 'A', email: 'nope' }, tags: ['a', 'b', 'c'] },
};

describe('valid variables', () => {
	test('reach the resolver as sent, and its data is the response', async () => {
		const { calls, resolver } = answering(ada);
		server.use(defaults.mockUserQuery(resolver));
		const { status, body } = await post(USER, { id: 'u_1' });
		expect(status).toBe(200);
		expect(body).toEqual({ data: ada });
		expect(calls).toEqual([{ id: 'u_1' }]);
	});

	test('a mutation is answered by its own handler', async () => {
		const { calls, resolver } = answering({
			signUp: { id: 'u_2', name: 'Ada' },
		});
		server.use(defaults.mockSignUpMutation(resolver));
		const { status, body } = await post(SIGN_UP, validSignUp);
		expect(status).toBe(200);
		expect(body).toEqual({ data: { signUp: { id: 'u_2', name: 'Ada' } } });
		expect(calls).toEqual([validSignUp]);
	});

	test('a codec scalar is checked as sent: a DateTime string passes', async () => {
		const { resolver } = answering({ signUp: null });
		server.use(defaults.mockSignUpMutation(resolver));
		const sent = {
			input: { ...validSignUp.input, birth: '1815-12-10T00:00:00Z' },
		};
		expect((await post(SIGN_UP, sent)).status).toBe(200);
	});
});

describe("invalidInput: 'invalid-input', the default", () => {
	test('answers one 400 error listing every field, without calling the resolver', async () => {
		const { calls, resolver } = answering({ signUp: null });
		server.use(defaults.mockSignUpMutation(resolver));
		const { status, body } = await post(SIGN_UP, invalidSignUp);
		expect(status).toBe(400);
		expect(calls).toEqual([]);
		expect(body).toEqual({
			errors: [
				{
					message: 'validation.errors.invalid-input',
					extensions: {
						code: 'validation.errors.invalid-input',
						fields: [
							{
								path: 'person.firstName',
								code: 'validation.errors.too-short',
								message: 'validation.errors.too-short',
							},
							{
								path: 'person.email',
								code: 'validation.errors.invalid-format',
								message: 'validation.errors.invalid-format',
							},
							{
								path: 'tags',
								code: 'validation.errors.too-many',
								message: 'validation.errors.too-many',
							},
						],
					},
				},
			],
		});
	});

	test('a variable outside `input` keeps its name in the path', async () => {
		server.use(defaults.mockUsersQuery(answering({ users: [] }).resolver));
		const { status, body } = await post(USERS, { first: 0 });
		expect(status).toBe(400);
		const [error] = body.errors as { extensions: { fields: unknown[] } }[];
		expect(error?.extensions.fields).toEqual([
			{
				path: 'first',
				code: 'validation.errors.out-of-range',
				message: 'validation.errors.out-of-range',
			},
		]);
	});

	test('each field has a code and no params', async () => {
		server.use(defaults.mockUsersQuery(answering({ users: [] }).resolver));
		const { body } = await post(USERS, { first: 51 });
		const [error] = body.errors as { extensions: { fields: unknown[] } }[];
		expect(error?.extensions.fields).toEqual([
			{
				path: 'first',
				code: 'validation.errors.out-of-range',
				message: 'validation.errors.out-of-range',
			},
		]);
	});

	test('with `translate`, each message is translated', async () => {
		server.use(translated.mockSignUpMutation(answering({}).resolver));
		const { status, body } = await post(SIGN_UP, invalidSignUp);
		expect(status).toBe(400);
		const [error] = body.errors as {
			message: string;
			extensions: { fields: { message: string }[] };
		}[];
		expect(error?.message).toBe('Some fields are invalid');
		expect(error?.extensions.fields.map((field) => field.message)).toEqual([
			'Too short',
			'Not valid',
			'validation.errors.too-many',
		]);
	});
});

describe("invalidInput: 'bad-user-input'", () => {
	test("answers withValidation's BAD_USER_INPUT error, status 200", async () => {
		const { calls, resolver } = answering({ signUp: null });
		server.use(badUserInput.mockSignUpMutation(resolver));
		const { status, body } = await post(SIGN_UP, invalidSignUp);
		expect(status).toBe(200);
		expect(calls).toEqual([]);
		const [error] = body.errors as {
			message: string;
			extensions: { code: string; issues: { path: unknown[] }[] };
		}[];
		expect(error?.message).toBe(
			'Invalid arguments for SignUp. input.person.firstName: Too small: expected string to have >=2 characters',
		);
		expect(error?.extensions.code).toBe('BAD_USER_INPUT');
		expect(error?.extensions.issues.map((issue) => issue.path)).toEqual([
			['input', 'person', 'firstName'],
			['input', 'person', 'email'],
			['input', 'tags'],
		]);
	});
});

describe("invalidInput: '<module>#<export>'", () => {
	test("answers with the application's error and status", async () => {
		const { calls, resolver } = answering({ users: [] });
		server.use(own.mockUsersQuery(resolver));
		const { status, body } = await post(USERS, { first: 51 });
		expect(status).toBe(422);
		expect(calls).toEqual([]);
		expect(body).toEqual({
			errors: [
				{
					message: 'Users refused',
					extensions: {
						code: 'UNPROCESSABLE',
						problems: [
							{ at: 'first', why: 'Too big: expected number to be <=50' },
						],
					},
				},
			],
		});
	});
});

describe('a status invalidInput returns', () => {
	const usersWith = (invalidInput: InvalidInput) =>
		mockOperation(
			{
				type: 'query',
				name: 'Users',
				variables: zUsersQueryVariables,
				variableTypes: { first: 'Int', role: 'Role' },
				inputTypes: {
					Int: { kind: 'builtin' },
					Role: { kind: 'enum', values: ['ADMIN', 'MEMBER'] },
				},
				endpoint: ENDPOINT,
				invalidInput,
			},
			answering({ users: [] }).resolver,
		);

	test("is ignored when no response can carry it: the error's own, else 200", async () => {
		for (const [status, extensions, expected] of [
			[204, undefined, 200],
			[99, { http: { status: 409 } }, 409],
			[700, undefined, 200],
		] as const) {
			server.use(
				usersWith(() => ({
					error: extensions ? { message: 'no', extensions } : { message: 'no' },
					status,
				})),
			);
			expect((await post(USERS, { first: 0 })).status).toBe(expected);
			server.resetHandlers();
		}
	});
});

describe('a hand-written handler, without variableTypes or inputTypes', () => {
	test('answers every refusal with invalidInput, the coercion ones included', async () => {
		const { calls, resolver } = answering({ users: [] });
		const seen: unknown[] = [];
		server.use(
			mockOperation(
				{
					type: 'query',
					name: 'Users',
					variables: zUsersQueryVariables,
					endpoint: ENDPOINT,
					invalidInput: (issues) => {
						seen.push(issues.map((issue) => issue.path));
						return { error: { message: 'refused' }, status: 422 };
					},
				},
				resolver,
			),
		);
		// graphql would refuse both while coercing them.
		expect(await post(USERS, { first: 'a', role: 'NOPE' })).toEqual({
			status: 422,
			body: { errors: [{ message: 'refused' }] },
		});
		expect(seen).toEqual([[['first'], ['role']]]);
		expect(calls).toEqual([]);
	});
});

describe('what the API refuses before validation', () => {
	// graphql-yoga 5.24 refuses these while coercing the variables: one
	// error per problem, no extensions, status 400 under either Accept.
	const refusal = (...errors: [string, number][]) => ({
		status: 400,
		body: {
			errors: errors.map(([message, column]) => ({
				message,
				locations: [{ line: 1, column }],
			})),
		},
	});

	for (const accept of [
		undefined,
		'application/json',
		'application/graphql-response+json',
	])
		describe(`accept: ${accept ?? 'none'}`, () => {
			test('a missing required variable', async () => {
				const { calls, resolver } = answering(ada);
				server.use(defaults.mockUserQuery(resolver));
				expect(await post(USER, {}, ENDPOINT, accept)).toEqual(
					refusal([
						'Variable "$id" of required type "ID!" was not provided.',
						12,
					]),
				);
				expect(calls).toEqual([]);
			});

			test('a null for a non-null variable', async () => {
				server.use(defaults.mockUserQuery(answering(ada).resolver));
				expect(await post(USER, { id: null }, ENDPOINT, accept)).toEqual(
					refusal([
						'Variable "$id" of non-null type "ID!" must not be null.',
						12,
					]),
				);
			});

			test('a value of the wrong type', async () => {
				server.use(defaults.mockUserQuery(answering(ada).resolver));
				expect(await post(USER, { id: true }, ENDPOINT, accept)).toEqual(
					refusal([
						'Variable "$id" got invalid value true; ID cannot represent value: true',
						12,
					]),
				);
			});

			test('an unknown enum value', async () => {
				server.use(defaults.mockUsersQuery(answering({ users: [] }).resolver));
				expect(await post(USERS, { role: 'NOPE' }, ENDPOINT, accept)).toEqual(
					refusal([
						'Variable "$role" got invalid value "NOPE"; Value "NOPE" does not exist in "Role" enum.',
						26,
					]),
				);
			});
		});

	test('an Int that is not one, or beyond 32 bits', async () => {
		server.use(defaults.mockUsersQuery(answering({ users: [] }).resolver));
		expect(await post(USERS, { first: 'a', role: 5 })).toEqual(
			refusal(
				[
					'Variable "$first" got invalid value "a"; Int cannot represent non-integer value: "a"',
					13,
				],
				[
					'Variable "$role" got invalid value 5; Enum "Role" cannot represent non-string value: 5.',
					26,
				],
			),
		);
		expect(await post(USERS, { first: 3_000_000_000 })).toEqual(
			refusal([
				'Variable "$first" got invalid value 3000000000; Int cannot represent non 32-bit signed integer value: 3000000000',
				13,
			]),
		);
	});

	test('an Int beyond 32 bits, or beyond the safe range', async () => {
		server.use(defaults.mockUsersQuery(answering({ users: [] }).resolver));
		for (const first of [1e20, -1e20])
			expect(await post(USERS, { first })).toEqual(
				refusal([
					`Variable "$first" got invalid value ${String(first)}; Int cannot represent non 32-bit signed integer value: ${String(first)}`,
					13,
				]),
			);
	});

	test('inside an input object: every type named from the schema, in graphql order', async () => {
		server.use(defaults.mockSignUpMutation(answering({}).resolver));
		const input = { person: { email: 'ada@example.com' }, extra: 1, tags: [1] };
		expect(await post(SIGN_UP, { input })).toEqual(
			refusal(
				[
					'Variable "$input" got invalid value { email: "ada@example.com" } at "input.person"; Expected value of type "PersonInput" to include required field "firstName", found: { email: "ada@example.com" }.',
					17,
				],
				[
					'Variable "$input" got invalid value 1 at "input.tags[0]"; String cannot represent a non string value: 1',
					17,
				],
				[
					'Variable "$input" got invalid value { person: { email: "ada@example.com" }, extra: 1, tags: [1] }; Expected value of type "SignUpInput" not to include unknown field "extra", found: { person: { email: "ada@example.com" }, extra: 1, tags: [1] }.',
					17,
				],
			),
		);
		expect(await post(SIGN_UP, { input: 'x' })).toEqual(
			refusal([
				'Variable "$input" got invalid value "x"; Expected value of type "SignUpInput" to be an object, found: "x".',
				17,
			]),
		);
		expect(
			await post(SIGN_UP, {
				input: { person: { firstName: null, email: 'ada@example.com' } },
			}),
		).toEqual(
			refusal([
				'Variable "$input" got invalid value null at "input.person.firstName"; Expected value of non-null type "String!" not to be null.',
				17,
			]),
		);
	});

	test('a field graphql does not know, with its suggestion', async () => {
		server.use(defaults.mockSignUpMutation(answering({}).resolver));
		const input = { person: { firstName: 'Ada', email: 'a@b.co' }, tag: 'a' };
		expect(await post(SIGN_UP, { input })).toEqual(
			refusal([
				'Variable "$input" got invalid value { person: { firstName: "Ada", email: "a@b.co" }, tag: "a" }; Expected value of type "SignUpInput" not to include unknown field "tag". Did you mean "tags"? Found: { person: { firstName: "Ada", email: "a@b.co" }, tag: "a" }.',
				17,
			]),
		);
	});

	test('a custom scalar refused by its schema, as a zodScalar words it', async () => {
		server.use(defaults.mockSignUpMutation(answering({}).resolver));
		const person = { firstName: 'Ada', email: 'ada@example.com' };
		expect(
			await post(SIGN_UP, { input: { person, birth: 'yesterday' } }),
		).toEqual(
			refusal([
				'Variable "$input" got invalid value "yesterday" at "input.birth"; DateTime cannot represent this input: Invalid ISO datetime',
				17,
			]),
		);
	});

	test('wins over a constraint: the API never reaches its validation', async () => {
		server.use(defaults.mockUsersQuery(answering({ users: [] }).resolver));
		const { status, body } = await post(USERS, { first: 0, role: 'NOPE' });
		expect(status).toBe(400);
		expect(body.errors).toHaveLength(1);
		expect(JSON.stringify(body)).not.toContain('validation.errors');
	});

	test("under invalidInput: 'bad-user-input' and a function of yours alike", async () => {
		const expected = refusal([
			'Variable "$first" got invalid value "a"; Int cannot represent non-integer value: "a"',
			13,
		]);
		server.use(badUserInput.mockUsersQuery(answering({ users: [] }).resolver));
		expect(await post(USERS, { first: 'a' })).toEqual(expected);
		server.resetHandlers();
		server.use(own.mockUsersQuery(answering({ users: [] }).resolver));
		expect(await post(USERS, { first: 'a' })).toEqual(expected);
		server.resetHandlers();
		server.use(translated.mockUsersQuery(answering({ users: [] }).resolver));
		expect(await post(USERS, { first: 'a' })).toEqual(expected);
	});
});

describe('the resolver', () => {
	test('throwing a GraphQLError answers with it, at its extensions.http.status, which the body leaves out', async () => {
		server.use(
			defaults.mockSignUpMutation(() => {
				throw fieldsError(
					'person.errors.duplicate',
					[{ path: 'person.email', code: 'person.errors.email-taken' }],
					{ status: 409 },
				);
			}),
		);
		const { status, body } = await post(SIGN_UP, validSignUp);
		expect(status).toBe(409);
		expect(body).toEqual({
			errors: [
				{
					message: 'person.errors.duplicate',
					extensions: {
						code: 'person.errors.duplicate',
						fields: [
							{
								path: 'person.email',
								code: 'person.errors.email-taken',
								message: 'person.errors.email-taken',
							},
						],
					},
				},
			],
		});
	});

	test('a GraphQLError subclass with its own name is answered at its status', async () => {
		class NotFoundError extends GraphQLError {
			override name = 'NotFoundError';
		}
		server.use(
			defaults.mockUserQuery(() => {
				throw new NotFoundError('No such user', {
					extensions: { code: 'NOT_FOUND', http: { status: 404 } },
				});
			}),
		);
		const { status, body } = await post(USER, { id: 'u_1' });
		expect(status).toBe(404);
		expect(body).toEqual({
			errors: [{ message: 'No such user', extensions: { code: 'NOT_FOUND' } }],
		});
	});

	test('a GraphQLError without a status answers 200', async () => {
		server.use(
			defaults.mockUserQuery(() => {
				throw new GraphQLError('Not yours', {
					extensions: { code: 'FORBIDDEN' },
				});
			}),
		);
		const { status, body } = await post(USER, { id: 'u_1' });
		expect(status).toBe(200);
		expect(body).toEqual({
			errors: [{ message: 'Not yours', extensions: { code: 'FORBIDDEN' } }],
		});
	});

	test('anything else it throws is left to msw, a 500', async () => {
		server.use(
			defaults.mockUserQuery(() => {
				throw new TypeError('a bug in the mock');
			}),
		);
		const quiet = spyOn(console, 'error').mockImplementation(() => {});
		try {
			expect((await post(USER, { id: 'u_1' })).status).toBe(500);
		} finally {
			quiet.mockRestore();
		}
	});

	test('returning nothing lets the next handler answer', async () => {
		// server.use puts its handlers first, in the order given.
		server.use(
			defaults.mockUserQuery(() => undefined),
			defaults.mockUserQuery(answering(ada).resolver),
		);
		expect((await post(USER, { id: 'u_1' })).body).toEqual({ data: ada });
	});

	test('returning an iterator fails, naming the operation', async () => {
		server.use(
			// The type refuses a generator; the runtime check is for untyped callers.
			defaults.mockUserQuery(function* () {
				yield HttpResponse.json({ data: { user: null } });
			} as never),
		);
		const quiet = spyOn(console, 'error').mockImplementation(() => {});
		const { status, body } = await post(USER, { id: 'u_1' }).finally(() =>
			quiet.mockRestore(),
		);
		expect(status).toBe(500);
		expect(JSON.stringify(body)).toContain(
			JSON.stringify(iteratorMessage('User')).slice(1, -1),
		);
	});
});

describe('options', () => {
	test('endpoint overrides the generated one for that handler', async () => {
		const other = 'https://other.example.com/graphql';
		server.use(
			defaults.mockUserQuery(answering(ada).resolver, { endpoint: other }),
		);
		expect((await post(USER, { id: 'u_1' }, other)).body).toEqual({
			data: ada,
		});
	});

	test("msw's once answers one request", async () => {
		server.use(
			defaults.mockUserQuery(answering(ada).resolver, { once: true }),
			defaults.mockUserQuery(answering({ user: null }).resolver),
		);
		expect((await post(USER, { id: 'u_1' })).body).toEqual({ data: ada });
		expect((await post(USER, { id: 'u_1' })).body).toEqual({
			data: { user: null },
		});
	});

	test('the generated endpoint is exported', () => {
		expect(defaults.endpoint).toBe(ENDPOINT);
	});
});
