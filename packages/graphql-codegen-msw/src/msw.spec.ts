import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	spyOn,
	test,
} from 'bun:test';
import { fieldsError } from '@nxgt/graphql-validation';
import { GraphQLError } from 'graphql';
import { HttpResponse } from 'msw';
import { ENDPOINT } from '../test/fixture';
import { iteratorMessage } from '../test/iterator-message';
import * as defaults from '../test/msw';
import * as badUserInput from '../test/msw-bad-user-input';
import * as own from '../test/msw-own';
import * as translated from '../test/msw-translate';
import { setupFetchNetwork } from '../test/network';

// The generated handlers, served by msw's network in this process: every
// request is a real fetch, answered by the handler the spec registers.
// `setup-server.spec.ts` runs msw/node's setupServer under Node.
const server = setupFetchNetwork();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const USER = 'query User($id: ID!) { user(id: $id) { id name joined } }';
const USERS = 'query Users($first: Int) { users(first: $first) { id } }';
const SIGN_UP =
	'mutation SignUp($input: SignUpInput!) { signUp(input: $input) { id name } }';

/** Posts one operation to `url`; the status and the parsed body. */
async function post(
	query: string,
	variables: Record<string, unknown>,
	url = ENDPOINT,
): Promise<{ status: number; body: { data?: unknown; errors?: unknown } }> {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
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
						http: { status: 400 },
						fields: [
							{
								path: 'person.firstName',
								code: 'validation.errors.too_small',
								message: 'validation.errors.too_small',
								params: { min: 2 },
							},
							{
								path: 'person.email',
								code: 'validation.errors.invalid_format',
								message: 'validation.errors.invalid_format',
								params: { format: 'email' },
							},
							{
								path: 'tags',
								code: 'validation.errors.too_big',
								message: 'validation.errors.too_big',
								params: { max: 2 },
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
				code: 'validation.errors.too_small',
				message: 'validation.errors.too_small',
				params: { min: 1 },
			},
		]);
	});

	test('a missing variable is refused too', async () => {
		server.use(defaults.mockUserQuery(answering(ada).resolver));
		const { status, body } = await post(USER, {});
		expect(status).toBe(400);
		const [error] = body.errors as { extensions: { fields: unknown[] } }[];
		expect(error?.extensions.fields).toEqual([
			{
				path: 'id',
				code: 'validation.errors.invalid_type',
				message: 'validation.errors.invalid_type',
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
			'At least 2',
			'Not a valid email',
			'validation.errors.too_big',
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

describe('the resolver', () => {
	test('throwing a GraphQLError answers with it, at its extensions.http.status', async () => {
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
						http: { status: 409 },
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
			errors: [
				{
					message: 'No such user',
					extensions: { code: 'NOT_FOUND', http: { status: 404 } },
				},
			],
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
