// Run under Node by `setup-server.spec.ts`, bundled first: msw/node's
// setupServer with the generated handlers, real fetch requests, and each
// answer printed as one JSON line for the spec to read.
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ENDPOINT } from './fixture';
import { mockSignUpMutation, mockUserQuery } from './msw';
import * as badUserInput from './msw-bad-user-input';
import * as own from './msw-own';

const server = setupServer();
server.listen({ onUnhandledFrame: 'error' });

const USER = 'query User($id: ID!) { user(id: $id) { id name joined } }';
const USERS = 'query Users($first: Int) { users(first: $first) { id } }';
const SIGN_UP =
	'mutation SignUp($input: SignUpInput!) { signUp(input: $input) { id name } }';
const invalid = {
	input: { person: { firstName: 'A', email: 'ada@example.com' } },
};

async function post(query: string, variables: Record<string, unknown>) {
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables }),
	});
	return { status: response.status, body: await response.json() };
}

const results: { [answer: string]: unknown } = {};
try {
	server.use(
		mockUserQuery(({ variables }) =>
			HttpResponse.json({
				data: { user: { id: String(variables.id), name: 'Ada', joined: null } },
			}),
		),
		mockSignUpMutation(() => HttpResponse.json({ data: { signUp: null } })),
	);
	results['data'] = await post(USER, { id: 'u_1' });
	results['invalidInput'] = await post(SIGN_UP, invalid);
	results['coercion'] = await post(USER, {});
	server.resetHandlers(
		badUserInput.mockSignUpMutation(() =>
			HttpResponse.json({ data: { signUp: null } }),
		),
		own.mockUsersQuery(() => HttpResponse.json({ data: { users: [] } })),
	);
	results['badUserInput'] = await post(SIGN_UP, invalid);
	results['own'] = await post(USERS, { first: 0 });
} finally {
	server.close();
}
console.log(JSON.stringify(results));
